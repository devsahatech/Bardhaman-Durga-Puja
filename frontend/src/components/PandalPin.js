import L from 'leaflet';

export function getPandalPinIcon({ state = 'default', index = 0, zoom = 15 }) {
  let stateClass = 'pandal-pin-default';
  if (state === 'selected') stateClass = 'pandal-pin-selected';
  else if (state === 'trending') stateClass = 'pandal-pin-trending';

  let scale = 1.0;
  if (zoom <= 12) scale = 0.45;
  else if (zoom === 13) scale = 0.55;
  else if (zoom === 14) scale = 0.7;
  else if (zoom === 15) scale = 0.85;

  const html = `
    <div class="pandal-pin-scale" style="transform: scale(${scale}); transform-origin: bottom center;">
      <div class="pandal-pin ${stateClass}">
        <div class="pandal-pin-inner">
          ${state === 'selected' && index > 0 ? `<span class="pandal-pin-index">${index}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'pandal-pin-wrapper',
    html,
    iconSize: [30 * scale, 42 * scale],
    iconAnchor: [15 * scale, 42 * scale]
  });
}
