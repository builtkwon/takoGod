// 최소 서비스 워커. 라이브러리 없음.
// CACHE 이름은 sw.js 로직이나 STATIC 구성이 바뀔 때만 올린다(activate가 옛 이름 캐시를 지운다). 빌드 해시 변경은 올리지 않는다.
// 자산 정리 방식: 셸 HTML(./)이 참조하지 않는 /assets/ 항목을 새 셸을 받을 때마다 지운다.
// 이유: 배포마다 sw.js 바이트가 같아 SW가 갱신되지 않으므로 install·activate에 정리를 걸 수 없고, 새 셸을 받는 내비게이션이 유일하게 확실한 시점이다.
const CACHE = 'takoyaki-v3';
const SCOPE = self.registration.scope;
const STATIC = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

/**
 * 셸 HTML이 참조하는 같은 출처 URL(해시 자산 포함).
 * shortcut: HTML의 src/href만 프리캐시한다. 동적 import·CSS url()·JS가 import하는 자산은 빠진다. 코드 분할이나 자산 import를 도입하면 Vite manifest 기반으로 바꾼다.
 */
function refsOf(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = new URL(m[1], SCOPE);
    if (u.origin === self.location.origin) urls.add(u.href);
  }
  return urls;
}

/** 참조 자산을 확보하고, 셸을 저장하고, 참조되지 않는 옛 /assets/ 항목을 지운다. 자산 확보가 실패하면 셸을 저장하지 않는다. */
async function syncShell(htmlResponse) {
  const html = await htmlResponse.text();
  const cache = await caches.open(CACHE);
  const refs = refsOf(html);
  await Promise.all([...refs].filter((u) => u !== SCOPE).map((u) => cache.match(u, { ignoreVary: true }).then((hit) => hit ?? cache.add(u))));
  await cache.put('./', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
  for (const req of await cache.keys()) {
    if (req.url.startsWith(`${SCOPE}assets/`) && !refs.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      // 첫 방문에서도 오프라인 셸이 되도록 install에서 셸과 build 자산을 받아 둔다.
      const shell = await fetch('./', { cache: 'reload' });
      if (!shell.ok) throw new Error(`셸 요청 실패: ${shell.status}`); // install을 실패시켜 오류 페이지를 셸로 저장하지 않는다.
      await syncShell(shell);
      await (await caches.open(CACHE)).addAll(STATIC);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()), // 첫 방문 페이지도 곧바로 SW 제어 아래로 넣는다.
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 내비게이션: 네트워크 우선. 성공한 셸은 정리와 함께 저장하고, 오프라인이면 캐시된 셸.
    // status 200만 저장한다(오류 페이지·206 부분 응답 제외).
    const net = fetch(req).then((res) => ({ res, copy: res.status === 200 ? res.clone() : null }));
    e.respondWith(net.then((x) => x.res).catch(() => caches.match('./').then((hit) => hit ?? Response.error())));
    e.waitUntil(net.then((x) => x.copy && syncShell(x.copy)).catch(() => undefined));
    return;
  }

  // 그 밖의 같은 출처 GET: 캐시 우선, 동시에 네트워크로 갱신(갱신 쓰기는 waitUntil 안에서 끝낸다).
  const work = (async () => {
    const cache = await caches.open(CACHE);
    // ignoreVary: 모듈 스크립트(crossorigin)는 Origin 헤더가 붙어, install에서 받은 항목과 Vary가 어긋나 못 찾을 수 있다.
    const hit = await cache.match(req, { ignoreVary: true });
    const net = fetch(req).then(async (res) => {
      if (res.status === 200) await cache.put(req, res.clone());
      return res;
    });
    return { hit, net };
  })();
  e.respondWith(work.then(({ hit, net }) => hit ?? net).catch(() => Response.error()));
  e.waitUntil(work.then(({ net }) => net).catch(() => undefined));
});
