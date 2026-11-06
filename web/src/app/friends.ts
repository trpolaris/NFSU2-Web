export interface FriendRow {
  name: string;
  where: 'roam' | 'online' | '';
  room?: string;
  contact?: string;
}
export interface FriendLists {
  me: string | null;
  friends: FriendRow[];
  asks: string[];
  sent: string[];
  mail: { from: string; body: string; t: number }[];
  done?: string;
  contact?: string | null;
}

/** The page's /friends endpoint, backed by the same EA Messenger lists the game uses. */
export class FriendsApi {
  constructor(private token: () => Promise<string | null>) {}

  private async ask(body?: Record<string, string>): Promise<FriendLists | null> {
    const token = await this.token().catch(() => null);
    if (!token) return null;
    const response = await fetch('/friends', {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const value = await response.json() as Record<string, unknown>;
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const friends: FriendRow[] = Array.isArray(value.friends) ? value.friends.flatMap((v): FriendRow[] => {
      if (!v || typeof v !== 'object' || typeof (v as any).name !== 'string') return [];
      const f = v as Record<string, unknown>;
      return [{
        name: f.name as string,
        where: f.where === 'roam' ? 'roam' : f.where === 'online' ? 'online' : '',
        ...(typeof f.room === 'string' ? { room: f.room } : {}),
        ...(typeof f.contact === 'string' ? { contact: f.contact } : {}),
      }];
    }) : [];
    const mail = Array.isArray(value.mail) ? value.mail.flatMap((v): FriendLists['mail'] => {
      if (!v || typeof v !== 'object') return [];
      const m = v as Record<string, unknown>;
      return typeof m.from === 'string' && typeof m.body === 'string'
        ? [{ from: m.from, body: m.body, t: typeof m.at === 'number' ? m.at : 0 }]
        : [];
    }) : [];
    return {
      me: typeof value.me === 'string' ? value.me : null,
      friends,
      asks: strings(value.asks),
      sent: strings(value.sent),
      mail,
      done: typeof value.done === 'string' ? value.done : undefined,
      contact: typeof value.contact === 'string' ? value.contact : null,
    };
  }

  list(): Promise<FriendLists | null> { return this.ask(); }
  room(name: string): Promise<FriendLists | null> { return this.ask({ op: 'room', room: name }); }
  act(op: 'ask' | 'accept' | 'decline' | 'remove' | 'block', name: string): Promise<FriendLists | null> {
    return this.ask({ op, name });
  }
  discord(name: string): Promise<FriendLists | null> {
    return this.ask({ op: 'discord', name });
  }
  send(name: string, body: string): Promise<FriendLists | null> {
    return this.ask({ op: 'msg', name, body });
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

export class FriendsPanel {
  private lists: FriendLists | null = null;
  private received: FriendLists['mail'] = [];
  private busy = false;
  private filter = '';

  constructor(private root: HTMLElement, private api: FriendsApi, private log: (line: string) => void, private room: () => string = () => '') {
    root.classList.add('menu-friends-panel');
    root.innerHTML = `
      <div class="friends-panel-head">
        <div><span class="menu-card-kicker">FRIENDS / EA MESSENGER</span><h5 data-friends-title>Arkadaşlar</h5></div>
        <button type="button" class="btn menu-action" data-friends-refresh>Yenile</button>
      </div>
      <p class="friends-panel-note" data-friends-note aria-live="polite">Arkadaş listesi yükleniyor…</p>
      <section class="friends-mailbox" data-friends-mailbox hidden>
        <div class="friends-mailbox-head"><h6>BEKLEYEN MESAJLAR <span data-friends-mail-count>0</span></h6><button type="button" class="friends-row-action" data-friends-mail-clear>Okundu</button></div>
        <ul data-friends-mail></ul>
      </section>
      <div class="friends-panel-tools">
        <form data-friends-ask><label><span>Oyuncu adına göre ekle</span><span class="friends-form-row"><input name="name" maxlength="64" autocomplete="off" placeholder="Oyuncu adı"><button class="btn menu-action" type="submit">İstek gönder</button></span></label></form>
        <label class="friends-filter"><span>Arkadaşlarda ara</span><input data-friends-filter type="search" autocomplete="off" placeholder="İsimle filtrele"></label>
      </div>
      <form class="friends-send" data-friends-send>
        <label><span>Arkadaşına mesaj gönder</span>
          <span class="friends-form-row">
            <select name="friend" aria-label="Mesaj gönderilecek arkadaş"><option value="">Arkadaş seç</option></select>
            <input name="body" maxlength="120" autocomplete="off" placeholder="Mesajın (en fazla 120 karakter)">
            <button class="btn menu-action" type="submit">Gönder</button>
          </span>
        </label>
      </form>
      <div class="friends-panel-columns">
        <section><h6>GELEN İSTEKLER <span data-friends-asks-count>0</span></h6><ul data-friends-asks></ul></section>
        <section><h6>ARKADAŞLAR <span data-friends-count>0</span></h6><ul data-friends-list></ul></section>
        <section><h6>GÖNDERİLEN İSTEKLER <span data-friends-sent-count>0</span></h6><ul data-friends-sent></ul></section>
      </div>
      <form class="friends-discord" data-friends-discord><label><span>Discord kullanıcı adın</span><span class="friends-form-row"><input name="discord" maxlength="40" autocomplete="off" placeholder="kullanici.adi"><button class="btn menu-action" type="submit">Kaydet</button></span></label><small>Bu alan yalnızca karşılıklı arkadaşlarına gösterilir.</small></form>`;
    root.addEventListener('submit', e => {
      const form = (e.target as HTMLElement).closest<HTMLFormElement>('form');
      if (!form) return;
      e.preventDefault();
      if (form.matches('[data-friends-ask]')) {
        const input = form.elements.namedItem('name') as HTMLInputElement;
        void this.perform('ask', input.value.trim()).then(() => { input.value = ''; });
      } else if (form.matches('[data-friends-discord]')) {
        const input = form.elements.namedItem('discord') as HTMLInputElement;
        void this.setDiscord(input.value.trim());
      } else if (form.matches('[data-friends-send]')) {
        const name = (form.elements.namedItem('friend') as HTMLSelectElement).value;
        const input = form.elements.namedItem('body') as HTMLInputElement;
        void this.sendMessage(name, input.value.trim()).then(ok => { if (ok) input.value = ''; });
      }
    });
    root.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.matches('[data-friends-refresh]')) void this.refresh();
      if (button.matches('[data-friends-mail-clear]')) {
        this.received = [];
        this.renderMail();
      }
      const op = button.dataset.friendOp as 'accept' | 'decline' | 'remove' | 'block' | undefined;
      const name = button.dataset.friendName;
      if (op && name) void this.perform(op, name);
    });
    root.addEventListener('input', e => {
      const input = e.target as HTMLInputElement;
      if (input.matches('[data-friends-filter]')) {
        this.filter = input.value.trim().toLocaleLowerCase();
        this.renderFriends();
      }
    });
    void this.refresh();
  }

  async refresh() {
    if (this.busy) return;
    this.busy = true;
    this.setNote('Arkadaş listesi yenileniyor…');
    try {
      const lists = await this.api.room(this.room());
      this.lists = lists;
      if (lists) this.keepMail(lists.mail);
      if (!lists) this.setNote('Arkadaş listesi kullanılamıyor. İsim sahipliğini ve çevrimiçi bağlantını kontrol et.');
      else if (!lists.me) this.setNote('Arkadaş eklemek için önce bulut kayıtlarından bir oyuncu adı sahiplenmelisin.');
      else this.setNote(`${lists.me} hesabı · ${lists.mail.length} bekleyen mesaj`);
      this.render();
    } catch (error) {
      this.setNote('Arkadaş listesi alınamadı.');
      this.log(`[friends] list refresh failed: ${error}`);
    } finally {
      this.busy = false;
    }
  }

  private setNote(text: string) {
    const node = this.root.querySelector<HTMLElement>('[data-friends-note]');
    if (node) node.textContent = text;
  }

  private async perform(op: 'ask' | 'accept' | 'decline' | 'remove' | 'block', name: string) {
    if (!name || this.busy) return;
    this.busy = true;
    this.setNote('İşlem gönderiliyor…');
    try {
      const lists = await this.api.act(op, name);
      if (lists) {
        this.lists = lists;
        this.keepMail(lists.mail);
        const labels: Record<string, string> = {
          asked: 'Arkadaşlık isteği gönderildi.',
          friends: 'Artık arkadaşsınız.',
          ok: 'İşlem tamamlandı.',
          none: 'Bekleyen istek veya arkadaş kaydı bulunamadı.',
          full: 'Arkadaş listesi dolu.',
          claim: 'Önce oyuncu adını sahiplenmelisin.',
          rate: 'Çok sık istek gönderiyorsun. Biraz bekle.',
          name: 'Oyuncu adı geçersiz.',
          self: 'Kendine arkadaşlık isteği gönderemezsin.',
        };
        this.setNote(labels[lists.done ?? ''] ?? 'İşlem tamamlandı.');
        this.render();
      } else {
        this.setNote('İşlem tamamlanamadı. Bağlantıyı kontrol et.');
      }
    } catch (error) {
      this.setNote('İşlem başarısız oldu.');
      this.log(`[friends] ${op} ${name}: ${error}`);
    } finally {
      this.busy = false;
    }
  }

  private async sendMessage(name: string, body: string): Promise<boolean> {
    if (!name || !body || this.busy) return false;
    this.busy = true;
    try {
      const lists = await this.api.send(name, body);
      if (!lists) {
        this.setNote('Mesaj gönderilemedi. Bağlantıyı kontrol et.');
        return false;
      }
      this.lists = lists;
      const labels: Record<string, string> = {
        sent: 'Mesaj arkadaşına iletildi.',
        kept: 'Arkadaşın çevrimdışı. Mesaj teslim edilmek üzere saklandı.',
        none: 'Bu oyuncu arkadaş listende bulunmuyor.',
        empty: 'Mesaj boş.',
        off: 'Mesaj gönderme bu hesap için geçici olarak kapalı.',
        full: 'Arkadaşının mesaj kutusu dolu.',
      };
      this.setNote(labels[lists.done ?? ''] ?? 'Mesaj gönderme işlemi tamamlandı.');
      this.render();
      return lists.done === 'sent' || lists.done === 'kept';
    } catch (error) {
      this.setNote('Mesaj gönderilemedi.');
      this.log(`[friends] message to ${name}: ${error}`);
      return false;
    } finally {
      this.busy = false;
    }
  }

  private async setDiscord(name: string) {
    if (this.busy) return;
    this.busy = true;
    try {
      const lists = await this.api.discord(name);
      if (lists) {
        this.lists = lists;
        this.setNote(lists.done === 'ok' ? 'Discord adı kaydedildi.' : lists.done === 'rate' ? 'Biraz bekleyip tekrar dene.' : 'Discord kullanıcı adı geçersiz.');
        this.render();
      } else this.setNote('Discord adı kaydedilemedi.');
    } finally {
      this.busy = false;
    }
  }

  private action(op: 'accept' | 'decline' | 'remove' | 'block', name: string, label: string) {
    const b = el('button', 'friends-row-action', label);
    b.type = 'button';
    b.dataset.friendOp = op;
    b.dataset.friendName = name;
    return b;
  }

  private item(name: string, state: string, actions: HTMLButtonElement[] = []) {
    const li = el('li', 'friends-row');
    const copy = el('span', 'friends-row-copy');
    copy.append(el('b', '', name), el('small', '', state));
    li.append(copy);
    if (actions.length) {
      const group = el('span', 'friends-row-actions');
      group.append(...actions);
      li.append(group);
    }
    return li;
  }

  /** a friend notification delivered over the game's LAN websocket */
  server(message: Record<string, unknown>) {
    if (message.op !== 'mail' || typeof message.from !== 'string' || typeof message.body !== 'string') return;
    const at = typeof message.at === 'number' ? message.at : Date.now();
    this.keepMail([{ from: message.from, body: message.body, t: at }]);
    if (this.root.isConnected) this.setNote(`Yeni arkadaş mesajı: ${message.from}`);
  }

  private keepMail(mail: FriendLists['mail']) {
    for (const item of mail) {
      const key = `${item.from.toLowerCase()}|${item.t}|${item.body}`;
      if (!this.received.some(x => `${x.from.toLowerCase()}|${x.t}|${x.body}` === key)) this.received.push(item);
    }
    this.renderMail();
  }

  private renderMail() {
    const box = this.root.querySelector<HTMLElement>('[data-friends-mailbox]');
    const list = this.root.querySelector<HTMLElement>('[data-friends-mail]');
    const count = this.root.querySelector<HTMLElement>('[data-friends-mail-count]');
    if (!box || !list || !count) return;
    list.replaceChildren();
    count.textContent = String(this.received.length);
    box.hidden = !this.received.length;
    for (const mail of this.received) {
      const row = el('li', 'friends-mail-row');
      row.append(el('b', '', mail.from), el('p', '', mail.body));
      list.append(row);
    }
  }

  private render() {
    const l = this.lists;
    this.root.querySelector<HTMLElement>('[data-friends-title]')!.textContent = l?.me ? `Arkadaşlar · ${l.friends.length}/250` : 'Arkadaşlar';
    this.root.querySelector<HTMLElement>('[data-friends-asks-count]')!.textContent = String(l?.asks.length ?? 0);
    this.root.querySelector<HTMLElement>('[data-friends-sent-count]')!.textContent = String(l?.sent.length ?? 0);
    this.root.querySelector<HTMLElement>('[data-friends-count]')!.textContent = String(l?.friends.length ?? 0);
    const asks = this.root.querySelector<HTMLElement>('[data-friends-asks]')!;
    asks.replaceChildren();
    for (const name of l?.asks ?? []) asks.append(this.item(name, 'Sana arkadaşlık isteği gönderdi', [
      this.action('accept', name, 'Kabul'), this.action('decline', name, 'Reddet'),
    ]));
    if (!asks.childElementCount) asks.append(el('li', 'friends-empty', 'Bekleyen istek yok.'));
    const sent = this.root.querySelector<HTMLElement>('[data-friends-sent]')!;
    sent.replaceChildren();
    for (const name of l?.sent ?? []) sent.append(this.item(name, 'Yanıt bekleniyor', [this.action('remove', name, 'Geri al')]));
    if (!sent.childElementCount) sent.append(el('li', 'friends-empty', 'Gönderilmiş istek yok.'));
    this.renderFriends();
    this.renderMail();
    const friendSelect = this.root.querySelector<HTMLSelectElement>('[name="friend"]');
    if (friendSelect) {
      const selected = friendSelect.value;
      friendSelect.replaceChildren(new Option('Arkadaş seç', ''));
      for (const friend of l?.friends ?? []) friendSelect.add(new Option(friend.name, friend.name));
      if ([...friendSelect.options].some(o => o.value === selected)) friendSelect.value = selected;
    }
    const discord = this.root.querySelector<HTMLInputElement>('[name="discord"]');
    if (discord && l?.contact && discord !== document.activeElement) discord.value = l.contact;
  }

  private renderFriends() {
    const list = this.root.querySelector<HTMLElement>('[data-friends-list]');
    if (!list) return;
    list.replaceChildren();
    const friends = (this.lists?.friends ?? []).filter(f => !this.filter || f.name.toLocaleLowerCase().includes(this.filter));
    for (const f of friends) {
      const state = f.where === 'roam'
        ? (f.room ? `Free Roam · ${f.room}` : 'Free Roam')
        : f.where === 'online' ? 'Online lobisi' : 'Çevrimdışı';
      list.append(this.item(f.name, state, [
        this.action('remove', f.name, 'Kaldır'),
        this.action('block', f.name, 'Engelle'),
      ]));
    }
    if (!list.childElementCount) list.append(el('li', 'friends-empty', this.filter ? 'Eşleşen arkadaş yok.' : 'Henüz arkadaş eklenmemiş.'));
  }
}
