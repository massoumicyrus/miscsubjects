
import { describe, it, expect } from 'vitest';
import { checkHeroBrief, checkHeroSubjectFit } from './title_hero_gate.js';

const TESOFENSINE_BRIEF = 'A single 2008 clinical trial page on dark slate, shot from above, with a '
  + 'deep oxblood EXPRESSION OF CONCERN rubber stamp across its upper third, and one unlabelled white '
  + 'pill on the slate beside it. Editorial still life, evidence register, no people, no vials, no '
  + 'mice, no laboratory equipment.';

describe('an exclusion is not a proposal', () => {
  it('accepts the exact tesofensine brief that was refused', () => {
    expect(checkHeroBrief(TESOFENSINE_BRIEF)).toBe(null);
  });

  it('accepts each banned noun when it appears behind its own negation cue', () => {
    const base = 'A cream 2008 journal page on charcoal slate under raking side light, one oxblood '
      + 'stamp landing across its upper third, shot from directly above as editorial still life. ';
    for (const excluded of ['no mice', 'no vials', 'no rats', 'no petri dish', 'no cage', 'no syringes on a tray', 'no pill bottles', 'no wax seal', 'no red string']) {
      expect(checkHeroBrief(base + excluded + '.'), excluded).toBe(null);
    }
  });

  it('honours the imperative form too', () => {
    const brief = 'A cream 2008 journal page on charcoal slate under raking side light with an oxblood '
      + 'stamp across its upper third, shot from above. Do not show mice or vials.';
    expect(checkHeroBrief(brief)).toBe(null);
  });
});

describe('the ban still bites when the brief actually asks for the thing', () => {
  it('refuses a lab animal proposed as the subject', () => {
    const err = checkHeroSubjectFit('A laboratory mouse in a cage under warm light, shot from above.');
    expect(err).toMatch(/research method as its subject/);
    expect(err).toContain('mouse');
  });

  it('refuses an interchangeable prop proposed as the subject', () => {
    const err = checkHeroSubjectFit('Two peptide vials on a silver tray, studio lit, shot from above.');
    expect(err).toMatch(/interchangeable prop/);
  });

  it('refuses the house motif when the article does not own it', () => {
    const err = checkHeroSubjectFit('A cracked red wax seal on cream paper, macro, raking light.');
    expect(err).toMatch(/house motif/);
  });

  it('still refuses a banned subject that follows an unrelated exclusion', () => {
    // The four-word bound is what makes this hold: "no readable text" is stripped, the mouse is not.
    const err = checkHeroSubjectFit('No readable text. A laboratory mouse in a cage, shot from above.');
    expect(err).toMatch(/research method as its subject/);
  });

  it('does not let a comma list smuggle a banned subject past the cue', () => {
    // Only "no people" carries a cue; "vials" does not, so it is still judged.
    const err = checkHeroSubjectFit('A journal page on slate, no people, vials, syringes on a tray.');
    expect(err).toMatch(/interchangeable prop/);
  });
});
