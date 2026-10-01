import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Star } from './PokeIcons';
import { StarRow } from '../kidgames/Common';

describe('Star icon', () => {
  it('IC-01 an earned star is gold; an unearned one (grey, no fill) is an empty outline', () => {
    const { container } = render(
      <>
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
        <Star className="w-4 h-4 text-slate-300" />
        <Star className="w-4 h-4" />
      </>
    );
    const stars = container.querySelectorAll('svg');
    expect(stars[0].dataset.empty).toBeUndefined();
    expect(stars[1].dataset.empty).toBe('true');
    expect(stars[2].dataset.empty).toBeUndefined(); // decorative stars stay gold
  });

  it('IC-02 StarRow shows exactly as many gold stars as earned', () => {
    render(<StarRow stars={1} />);
    const row = screen.getByLabelText('1 sao');
    const svgs = row.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
    expect([...svgs].map((s) => s.dataset.empty === 'true')).toEqual([false, true, true]);
  });
});
