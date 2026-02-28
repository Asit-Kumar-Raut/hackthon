/**
 * GEC Map - Gandhi Engineering College (Autonomous), Bhubaneswar, Odisha
 * Uses Google Maps embed from: https://maps.app.goo.gl/Ki9UKhF3cG6fHJYp9
 * With Leaflet overlay for drawing restricted area
 */
import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const GEC_MAPS_LINK = 'https://maps.app.goo.gl/Ki9UKhF3cG6fHJYp9';
const GEC_CENTER = [20.3522, 85.8175];
const CAMPUS_ZOOM = 19;
const GEC_BOUNDS = [
  [20.346, 85.810],
  [20.358, 85.825],
];

function MapDrawingHandler({ isDrawing, boundaryPoints, onAddPoint, onMouseMove }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
    mousemove(e) {
      if (isDrawing) onMouseMove([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function GECMap({ boundaryPoints, onBoundaryChange, isDrawing }) {
  const [hoverPos, setHoverPos] = useState(null);

  const positions = boundaryPoints.map((p) => (Array.isArray(p) ? p : [p.lat ?? p.y, p.lng ?? p.x]));
  const previewLine = hoverPos && positions.length > 0
    ? [...positions, hoverPos]
    : [];

  return (
    <div
      className="gec-map-container"
      style={{
        height: '500px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: isDrawing ? 'crosshair' : 'default',
        position: 'relative',
      }}
    >
      <iframe
        title="GEC Map - Gandhi Engineering College Bhubaneswar"
        src="https://www.google.com/maps?q=Gandhi+Engineering+College+Bhubaneswar+Odisha&z=19&output=embed"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
      <MapContainer
        center={GEC_CENTER}
        zoom={CAMPUS_ZOOM}
        minZoom={18}
        maxZoom={20}
        maxBounds={GEC_BOUNDS}
        maxBoundsViscosity={0.9}
        style={{ height: '100%', width: '100%', background: 'transparent' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution=""
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0}
        />
        <MapDrawingHandler
          isDrawing={isDrawing}
          boundaryPoints={boundaryPoints}
          onAddPoint={(pt) => onBoundaryChange([...boundaryPoints, pt])}
          onMouseMove={setHoverPos}
        />
        {previewLine.length >= 2 && (
          <Polyline
            positions={previewLine}
            pathOptions={{
              color: '#ffc107',
              weight: 2,
              dashArray: '8, 8',
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}
        {positions.length >= 3 && (
          <Polygon
            positions={positions}
            pathOptions={{
              color: '#ffc107',
              fillColor: '#ffc107',
              fillOpacity: 0.3,
              weight: 3,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}
      </MapContainer>
      </div>
      <a
        href={GEC_MAPS_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm btn-dark position-absolute bottom-0 end-0 m-2"
        style={{ zIndex: 1001 }}
      >
        Open in Google Maps
      </a>
    </div>
  );
}
