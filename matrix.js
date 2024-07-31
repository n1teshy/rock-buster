export const block = {
  WIDTH: 10,
  HEIGHT: 10,
};

export const matrixDims = {
  width: window.innerWidth,
  height: window.innerHeight,
};

export const matrix = Array(Math.floor(matrixDims.height / block.HEIGHT))
  .fill(null)
  .map(() => Array(Math.floor(matrixDims.width / block.WIDTH)).fill(null));

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
export const ctx = canvas.getContext("2d");
