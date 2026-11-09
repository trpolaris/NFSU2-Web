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
"${CC}" --version

# Fail before compilation if any web-only C source is selected by both loops.
python3 tools/check_runtime_source_ownership.py
WASI="${WASI}" web/tools/aliasguard.sh

flags=(
  --target=wasm32-wasip1-threads -pthread -O3
  -msimd128 -mbulk-memory -mnontrapping-fptoint -mtail-call
  -mexception-handling -mllvm -wasm-enable-sjlj
  -mllvm -wasm-use-legacy-eh=false
  -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_SIGNAL
  -D_WASI_EMULATED_PROCESS_CLOCKS -fno-delete-null-pointer-checks
  -include runtime/web/compat/wasm_plat.h
  -Iruntime/web/compat -Iruntime -Igen/all
  -Wno-unused-label -Wno-parentheses-equality
  -DNFS_ENHANCED=0
)

index=0
for source in runtime/com.c runtime/mpcredit.c runtime/mpcredit_store.c runtime/web/sbrk.c; do
  object="${RUNNER_TEMP}/nfsu2-wasi-unit-${index}.o"
  echo "Compile ${source} -> ${object}"
  "${CC}" "${flags[@]}" -c "${source}" -o "${object}"
  index=$((index + 1))
done
