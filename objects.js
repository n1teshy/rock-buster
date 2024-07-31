import { block, matrix, matrixDims, ctx } from "./matrix.js";
import { sleep } from "./utils.js";
import { UnimplementedMethodError } from "./errors.js";

const explosionSound = new Audio("./explosion.wav");
const shotSound = new Audio("./shot.mp3");

class Renderable {
  constructor() {}

  render() {
    throw new UnimplementedMethodError(this.constructor.name, "render");
  }

  draw() {
    throw new UnimplementedMethodError(this.constructor.name, "draw");
  }

  clear() {
    throw new UnimplementedMethodError(this.constructor.name, "clear");
  }
}

class Movable extends Renderable {
  constructor({ position, dx, dy } = {}) {
    super();
    this.position = position;
    this.dx = dx;
    this.dy = dy;
    this.isDestroyed = false;
  }

  destroy() {
    this.isDestroyed = true;
    this.clear();
  }

  loop() {
    throw new UnimplementedMethodError(this.constructor.name, "loop");
  }
}

export class Rock extends Movable {
  constructor({
    position = [0, 0],
    dx = block.WIDTH,
    dy = block.HEIGHT,
    color = "darkgray",
    damage = 1,
  } = {}) {
    super({ position, dx, dy });
    this.color = color;
    this.damage = damage;
  }

  draw() {
    ctx.fillStyle = this.color;
    const [x, y] = this.position;
    ctx.fillRect(x, y, block.WIDTH, block.HEIGHT);
  }

  clear() {
    const [x, y] = this.position;
    ctx.clearRect(x, y, block.WIDTH, block.HEIGHT);
  }

  *loop() {
    while (true) {
      if (this.position[1] >= matrixDims.height) {
        this.destroy();
      }
      this.draw();
      // IV -> vertical index in matrix, IH -> horizontal index in matrix
      // TODO: IH is always going to be same, only compute once
      const [IV, IH] = [
        Math.floor(this.position[1] / block.HEIGHT),
        Math.floor(this.position[0] / block.WIDTH),
      ];
      const updatable = IV < matrix.length;
      if (updatable) {
        matrix[IV][IH] = this;
      }
      yield;
      this.clear();
      if (updatable) {
        matrix[IV][IH] = null;
      }
      this.position[1] += this.dy;
    }
  }

  async render() {
    const stepper = this.loop();
    while (!this.isDestroyed) {
      await new Promise((res) => {
        requestAnimationFrame(async () => {
          stepper.next();
          await sleep(400);
          res();
        });
      });
    }
    this.clear();
  }
}

class Missile extends Movable {
  constructor({
    position,
    dx = block.WIDTH,
    dy = block.HEIGHT,
    color = "darkgray",
    damage = 1,
  } = {}) {
    super({ position, dx, dy });
    this.color = color;
    this.damage = damage;
  }

  draw() {
    ctx.fillStyle = this.color;
    const [x, y] = this.position;
    ctx.fillRect(x, y, block.WIDTH, block.HEIGHT);
  }

  clear() {
    const [x, y] = this.position;
    ctx.clearRect(x, y, block.WIDTH, block.HEIGHT);
  }

  getDestroyableRocks(IV, IH) {
    const rocks = [];
    let rockIdxs = [
      [IV, IH],
      [IV - 1, IH],
      [IV - 1, IH - 1],
      [IV - 1, IH + 1],
    ];
    rockIdxs = rockIdxs.filter(([IV, IH]) => IV >= 0 && IH >= 0);
    for (const rockIdx of rockIdxs) {
      const [i, j] = rockIdx;
      const rock = matrix[i][j];
      if (rock === null) {
        continue;
      }
      if (
        Math.abs(rock.position[0] - this.position[0]) < block.WIDTH ||
        Math.abs(rock.position[1] - this.position[1]) <
          block.HEIGHT
      ) {
        rocks.push([i, j]);
      }
    }
    return rocks;
  }

  *loop() {
    while (true) {
      if (this.position[1] < 0) {
        this.destroy();
      }
      this.draw();
      const [IV, IH] = [
        Math.floor(this.position[1] / block.HEIGHT),
        Math.floor(this.position[0] / block.WIDTH),
      ];
      const updatable = IV >= 0;
      if (updatable) {
        const badRocks = this.getDestroyableRocks(IV, IH);
        if (badRocks.length > 0) {
          for (const [i, j] of badRocks) {
            matrix[i][j].destroy();
            matrix[i][j] = null;
          }
          this.destroy();
          explosionSound.play();
          return
        }
        matrix[IV][IH] = this;
      }
      yield;
      this.clear();
      if (updatable) {
        matrix[IV][IH] = null;
      }
      this.position[1] -= this.dy;
    }
  }

  async render() {
    const stepper = this.loop();
    while (!this.isDestroyed) {
      await new Promise((res) => {
        requestAnimationFrame(async () => {
          stepper.next();
          await sleep(10);
          res();
        });
      });
    }
    this.clear();
  }
}

export class Ship extends Movable {
  static getInitialPosition() {
    const x = Math.floor(matrixDims.width / 2) - block.WIDTH * 3;
    const y = matrixDims.height - block.HEIGHT * 2;
    return [x, y];
  }

  constructor({
    position = Ship.getInitialPosition(),
    dx = block.WIDTH,
    dy = block.HEIGHT,
    color = "darkgray",
  } = {}) {
    super({ position, dx, dy });
    this.color = color;
    this.shotsFired = 0;
    this.firedAt = Date.now();
  }

  getClearOffsets(direction) {
    const offsets = [[1, 0]];
    if (direction) {
      if (direction === "left") {
        offsets.push([2, 1]);
      } else {
        offsets.push([0, 1]);
      }
    } else {
      offsets.push(
        ...[
          [0, 1],
          [1, 1],
          [2, 1],
        ]
      );
    }
    return offsets;
  }

  clear(direction) {
    const offsets = this.getClearOffsets(direction);
    for (const offset of offsets) {
      const [oX, oY] = offset;
      const [pX, pY] = this.position;
      ctx.clearRect(
        pX + block.WIDTH * oX,
        pY + block.HEIGHT * oY,
        block.WIDTH,
        block.HEIGHT
      );
    }
  }

  getDrawOffsets(direction) {
    let offsets = [[1, 0]];
    if (direction) {
      if (direction === "left") {
        offsets.push([0, 1]);
      } else {
        offsets.push([2, 1]);
      }
    } else {
      offsets.push(
        ...[
          [0, 1],
          [1, 1],
          [2, 1],
        ]
      );
    }
    return offsets;
  }

  draw(direction) {
    const offsets = this.getDrawOffsets(direction);
    ctx.fillStyle = this.color;
    for (const offset of offsets) {
      const [oX, oY] = offset;
      const [pX, pY] = this.position;
      ctx.fillRect(
        pX + block.WIDTH * oX,
        pY + block.HEIGHT * oY,
        block.WIDTH,
        block.HEIGHT
      );
    }
  }

  shoot() {
    const [x, y] = [
      this.position[0] + block.WIDTH,
      this.position[1] + -1 * block.HEIGHT,
    ];
    const missile = new Missile({ position: [x, y] });
    shotSound.play();
    missile.render();
  }

  step(direction) {
    const _x = this.position[0] + (direction === "left" ? -1 : 1) * this.dx;
    if (_x < 0 || _x + block.WIDTH * 3 > matrixDims.width) {
      return;
    }
    this.clear(direction);
    this.position[0] += (direction === "left" ? -1 : 1) * this.dx;
    this.draw();
  }

  render() {
    this.draw();
    window.addEventListener("keydown", (event) => {
      const code = event.keyCode;
      requestAnimationFrame(() => {
        if (code === 37 || code === 39) {
          this.step(code === 37 ? "left" : "right");
        }
        if (code === 32) {
          this.shoot();
        }
      });
    });
  }
}
