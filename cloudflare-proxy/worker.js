const UPSTREAM = "https://gaokao-word-master-2026.leiyan2006.chatgpt.site";
const PREFIX = "/cc/wordmemorize";
const LEGACY_PREFIX = "/cc/wordmomerize";

const worker = {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname === LEGACY_PREFIX || incoming.pathname.startsWith(`${LEGACY_PREFIX}/`)) {
      const suffix = incoming.pathname.slice(LEGACY_PREFIX.length);
      return Response.redirect(`${incoming.origin}${PREFIX}${suffix || "/"}${incoming.search}`, 308);
    }
    if (incoming.pathname !== PREFIX && !incoming.pathname.startsWith(`${PREFIX}/`)) {
      return new Response("Not found", { status: 404 });
    }

    const isStaticAsset = incoming.pathname.startsWith(`${PREFIX}/assets/`)
      || incoming.pathname === `${PREFIX}/favicon.svg`
      || incoming.pathname === `${PREFIX}/og.png`;
    const upstreamPath = isStaticAsset ? incoming.pathname.slice(PREFIX.length) : incoming.pathname;
    const upstreamUrl = new URL(`${upstreamPath}${incoming.search}`, UPSTREAM);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", "https");
    headers.delete("cookie");

    const upstreamResponse = await fetch(new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    }));

    const responseHeaders = new Headers(upstreamResponse.headers);
    const location = responseHeaders.get("location");
    if (location?.startsWith(UPSTREAM)) {
      responseHeaders.set("location", location.replace(UPSTREAM, incoming.origin));
    }
    responseHeaders.delete("set-cookie");
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.set("referrer-policy", "strict-origin-when-cross-origin");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

export default worker;
