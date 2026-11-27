/** UI 칸: 캔버스(세로 비율 고정, 화면이 넓으면 가운데 칸)의 가로 범위. layer 좌표. */
export interface Column {
  readonly left: number;
  readonly width: number;
}

interface Box {
  readonly left: number;
  readonly width: number;
}

/** 캔버스가 없거나(0 폭) layer 밖이면 layer 전체를 칸으로 쓴다. 칸은 항상 layer 안으로 자른다. */
export function columnOf(layer: Box, canvas: Box | null): Column {
  if (!canvas || canvas.width <= 0) return { left: 0, width: layer.width };
  const l = Math.max(canvas.left, layer.left);
  const r = Math.min(canvas.left + canvas.width, layer.left + layer.width);
  return r > l ? { left: l - layer.left, width: r - l } : { left: 0, width: layer.width };
}
