#!/usr/bin/env bash
set -euo pipefail

sdk_dir="${RUNNER_TEMP}/wasi-sdk-34.0-x86_64-linux"
archive="${RUNNER_TEMP}/wasi-sdk-34.0-x86_64-linux.tar.gz"

if [[ ! -x "${sdk_dir}/bin/clang" ]]; then
  curl -fsSL --retry 3 --retry-all-errors \
    https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/wasi-sdk-34.0-x86_64-linux.tar.gz \
    -o "${archive}"
  tar -xzf "${archive}" -C "${RUNNER_TEMP}"
fi

export WASI="${sdk_dir}"
CC="${WASI}/bin/clang"
CXX="${WASI}/bin/clang++"
"${CC}" --version
"${CXX}" --version

# Fail before compilation if any web-only C source is selected by both loops.
python3 tools/check_runtime_source_ownership.py
WASI="${WASI}" web/tools/aliasguard.sh

flags=(
  --target=wasm32-wasip1-threads -pthread -O3
  -msimd128 -mbulk-memory -mnontrapping-fptoint -mtail-call
  -mexception-handling -mllvm -wasm-enable-sjlj
  -mllvm -wasm-use-legacy-eh=false
  -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_SIGNAL
  -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_GETPID
  -fno-delete-null-pointer-checks
  -include runtime/web/compat/wasm_plat.h
  -Iruntime/web/compat -Iruntime -Igen/all
  -Wno-unused-label -Wno-parentheses-equality
  -DNFS_ENHANCED=0
)

index=0
for source in runtime/com.c runtime/mpcredit.c runtime/mpcredit_store.c runtime/mprace.c runtime/roam_game.c runtime/web/sbrk.c runtime/intro.c runtime/modpacks.c runtime/dinput_kbd.c runtime/dinput_pad.c runtime/horn.c runtime/features.c runtime/photo.c runtime/garage.c runtime/travel.c runtime/drift.c runtime/widescreen.c runtime/framerate.c runtime/stance.c runtime/savegame.c runtime/web/gpu_web.c runtime/web/status_web.c; do
  object="${RUNNER_TEMP}/nfsu2-wasi-unit-${index}.o"
  echo "Compile ${source} -> ${object}"
  "${CC}" "${flags[@]}" -c "${source}" -o "${object}"
  index=$((index + 1))
done

# The production link uses WASI's explicit getpid emulation library. Compile
# and link a tiny real wasm module so a missing -D/-l pair cannot regress.
getpid_src="${RUNNER_TEMP}/nfsu2-wasi-getpid-link.c"
getpid_wasm="${RUNNER_TEMP}/nfsu2-wasi-getpid-link.wasm"
cat > "${getpid_src}" <<'EOF'
#include <sys/types.h>
#include <unistd.h>
int main(void) { return getpid() == (pid_t)-1; }
EOF
"${CC}" --target=wasm32-wasip1-threads -pthread -D_WASI_EMULATED_GETPID \
  "${getpid_src}" -o "${getpid_wasm}" -lwasi-emulated-getpid
test -s "${getpid_wasm}"

# damagecore.cpp is a C++ object. The production link must use clang++ so the
# WASI C++ ABI supplies the sized operator delete emitted by C++17 code.
sized_delete_src="${RUNNER_TEMP}/nfsu2-wasi-sized-delete-link.cpp"
sized_delete_wasm="${RUNNER_TEMP}/nfsu2-wasi-sized-delete-link.wasm"
cat > "${sized_delete_src}" <<'EOF'
#include <cstddef>
#include <new>

void release_sized(void *p) {
  ::operator delete(p, static_cast<std::size_t>(32));
}

int main() { return 0; }
EOF
"${CXX}" --target=wasm32-wasip1-threads -pthread -std=c++17 \
  -fno-exceptions -fno-rtti "${sized_delete_src}" -o "${sized_delete_wasm}"
test -s "${sized_delete_wasm}"

# The runtime's browser lobby calls this API and the native build includes
# the same implementation. Catch declaration-only regressions before link.
grep -Eq '^[[:space:]]*int[[:space:]]+mprace_counts\(void\)[[:space:]]*\{' runtime/mprace.c
grep -Fq 'mprace_counts' runtime/mprace.h
grep -Fq 'mprace_counts()' runtime/roam_game.c
grep -Fq -- '-D_WASI_EMULATED_GETPID' web/build.sh
grep -Fq -- '-lwasi-emulated-getpid' web/build.sh
