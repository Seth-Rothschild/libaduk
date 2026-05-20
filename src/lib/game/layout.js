export function computeVertexSize(containerWidth, containerHeight, boardSize) {
  if (containerWidth <= 0) return 24;
  const available =
    containerHeight > 0 ? Math.min(containerWidth, containerHeight) : containerWidth;
  return available / (boardSize + 0.8);
}
