/** Map a trend to a bundled illustration, by tag id or by an obviously-same dish name. */
const BY_NAME: { re: RegExp; src: string; alt: string }[] = [
  { re: /^salt bread|^shio pan/i, src: "/trends/salt-bread.webp", alt: "Salt bread rolls topped with sea salt, one torn open to show butter inside" },
  { re: /^pan dulce|^conchas?$/i, src: "/trends/pan-dulce.webp", alt: "Pink, vanilla and chocolate Mexican conchas on a bakery tray with coffee" },
  { re: /^puff[- ]?puff/i, src: "/trends/puff-puff.webp", alt: "Sugar-dusted Nigerian puff-puff in an enamel bowl on Ankara print cloth" },
];
export function imageFor(tagId: string, name: string, byId: Record<string, { src: string; alt: string }>): { image: string; imageAlt: string } | undefined {
  const hit = byId[tagId] ?? BY_NAME.find((x) => x.re.test(name.replace(/^\[MOCK\]\s*/, "")));
  return hit ? { image: hit.src, imageAlt: hit.alt } : undefined;
}
