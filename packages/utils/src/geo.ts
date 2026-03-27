/**
 * Utilitario de geometria para verificar se um ponto esta dentro de um poligono.
 * Usa o algoritmo de ray casting (lancamento de raio).
 */

/**
 * Checks if a point is inside a polygon using the ray casting algorithm.
 *
 * The algorithm casts a horizontal ray from the point to the right and
 * counts how many times it crosses the polygon's edges. If the count
 * is odd, the point is inside; if even, it's outside.
 *
 * @param point - The point to check, with lat and lng coordinates.
 * @param polygon - An array of vertices defining the polygon (min 3 points).
 * @returns true if the point is inside the polygon, false otherwise.
 */
export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  const { lat: x, lng: y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lat;
    const yi = polygon[i]!.lng;
    const xj = polygon[j]!.lat;
    const yj = polygon[j]!.lng;

    // Check if the ray from the point crosses this edge
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
