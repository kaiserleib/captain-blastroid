// Shade slab: a 40×10 riveted sunshade panel, lit from the top-left, with a
// row of amber running lights so it reads as cover rather than a rock.
import { SHADE_SLAB } from '../../../content/obstacles';
import { defineProcSprite } from '../../../gfx/sprite';

const W = SHADE_SLAB.w;
const H = SHADE_SLAB.h;

defineProcSprite('shade_slab', W, H, (ctx) => {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  px(0, 0, W, H, '#100818');
  px(1, 1, W - 2, H - 2, '#484058');
  px(1, 1, W - 2, 1, '#8880a0');
  px(1, 2, 1, H - 4, '#686080');
  px(1, H - 2, W - 2, 1, '#282038');
  px(W - 2, 2, 1, H - 4, '#383048');
  px(2, 4, W - 4, 2, '#383048');
  for (let x = 4; x < W - 3; x += 8) {
    px(x, 2, 1, 1, '#a098b8');
    px(x, H - 3, 1, 1, '#a098b8');
  }
  for (const x of [7, 15, 24, 32]) px(x, 4, 2, 1, '#f8b830');
});
