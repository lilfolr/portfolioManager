import { dark, light, ramp, sourceDots } from '@/src/theme/palette';

// CLAUDE.md: "Every screen and component must support light and dark theme."
// The failure mode that actually happens is a token added to one variant and
// forgotten in the other -- the class then resolves to an undefined CSS
// variable and the element renders transparent in exactly one theme. These
// assertions catch that at build time.
describe('ledger palette', () => {
  it('defines the same tokens in both themes', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('has a non-empty hex value for every token in both themes', () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const [name, value] of Object.entries(light)) {
      expect(`${name}=${value}`).toMatch(new RegExp(`^${name}=#[0-9A-Fa-f]{6}$`));
      expect(value).toMatch(hex);
    }
    for (const value of Object.values(dark)) {
      expect(value).toMatch(hex);
    }
  });

  it('gives the composition ramp nine stops in both themes', () => {
    expect(ramp.light).toHaveLength(9);
    expect(ramp.dark).toHaveLength(9);
  });

  it('keys the source dots identically in both themes', () => {
    expect(Object.keys(sourceDots.dark).sort()).toEqual(
      Object.keys(sourceDots.light).sort(),
    );
  });

  it('does not reuse a light value in the dark theme for surfaces', () => {
    // Surfaces must genuinely differ -- a copy-paste that left a light surface
    // in the dark variant is invisible in review but obvious here.
    const surfaces = Object.keys(light).filter((k) => k.startsWith('surface'));
    for (const key of surfaces) {
      expect(dark[key as keyof typeof dark]).not.toBe(
        light[key as keyof typeof light],
      );
    }
  });
});
