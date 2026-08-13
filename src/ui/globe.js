const DEG = Math.PI / 180;
import { trackLocalName } from '../game/track-meta.js';

export function projectGlobePoint(lat, lon, centerLon = 0, centerLat = 12, radius = 1) {
  const phi = lat * DEG, lambda = (lon - centerLon) * DEG, phi0 = centerLat * DEG;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const cosLambda = Math.cos(lambda), sinLambda = Math.sin(lambda);
  const depth = Math.sin(phi0) * sinPhi + Math.cos(phi0) * cosPhi * cosLambda;
  return {
    x: radius * cosPhi * sinLambda,
    y: -radius * (Math.cos(phi0) * sinPhi - Math.sin(phi0) * cosPhi * cosLambda),
    depth,
    visible: depth >= 0
  };
}

export function clipVisibleRing(coordinates, centerLon = 0, centerLat = 12, radius = 1) {
  const source = coordinates.length > 1
    && coordinates[0][0] === coordinates.at(-1)[0]
    && coordinates[0][1] === coordinates.at(-1)[1]
    ? coordinates.slice(0, -1) : coordinates.slice();
  if (source.length < 3) return [];
  const projected = source.map(([longitude, latitude]) => projectGlobePoint(latitude, longitude, centerLon, centerLat, radius));
  if (projected.every(point => point.visible)) return [{ points:projected, clipped:false }];
  if (projected.every(point => !point.visible)) return [];
  const firstHidden = projected.findIndex(point => !point.visible);
  const ordered = Array.from({ length:projected.length }, (_, index) => projected[(firstHidden + index) % projected.length]);
  const intersection = (a, b) => {
    const t = a.depth / (a.depth - b.depth);
    let x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    const length = Math.hypot(x, y) || 1;
    x *= radius / length; y *= radius / length;
    return { x, y, depth:0, visible:true };
  };
  const segments = [];
  let current = null;
  for (let index=0; index<ordered.length; index++) {
    const a = ordered[index], b = ordered[(index+1) % ordered.length];
    if (!a.visible && b.visible) current = [intersection(a,b), b];
    else if (a.visible && b.visible) {
      if (!current) current = [a];
      current.push(b);
    } else if (a.visible && !b.visible && current) {
      current.push(intersection(a,b));
      const first=current[0], last=current.at(-1);
      segments.push({
        points:current, clipped:true,
        startAngle:Math.atan2(first.y,first.x),
        endAngle:Math.atan2(last.y,last.x)
      });
      current=null;
    }
  }
  return segments;
}

// 真实世界陆地轮廓，从根目录 world.geojson（Natural Earth 110m land）异步加载。
let LAND_FEATURES = null;
let LAND_LOADING = null;
export function loadLand() {
  if (LAND_FEATURES) return Promise.resolve(LAND_FEATURES);
  if (LAND_LOADING) return LAND_LOADING;
  LAND_LOADING = fetch('./world.geojson').then(r => r.json()).then(gj => {
    LAND_FEATURES = (gj.features || []).map(f => {
      const geom = f.geometry;
      if (geom.type === 'Polygon') return { rings: geom.coordinates };
      if (geom.type === 'MultiPolygon') return { rings: geom.coordinates.flat() };
      return null;
    }).filter(Boolean);
    return LAND_FEATURES;
  }).catch(() => { LAND_FEATURES = []; return []; });
  return LAND_LOADING;
}

export function createTrackGlobe(canvas, tracks, onSelect) {
  if (!canvas?.getContext) return { setSelected() {}, destroy() {} };
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, radius = 0, dpr = 1;
  let lon = 18, lat = 12, targetLon = lon, targetLat = lat;
  let selectedId = null, dragging = false, moved = false, lastX = 0, lastY = 0;
  let raf = 0, previousTime = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.max(80, Math.min(width, height) * .39);
  };

  const point = (latitude, longitude) => {
    const p = projectGlobePoint(latitude, longitude, lon, lat, radius);
    return { ...p, x:width * .5 + p.x, y:height * .5 + p.y };
  };

  const drawRing = coordinates => {
    clipVisibleRing(coordinates, lon, lat, radius).forEach(segment => {
      const points = segment.points;
      ctx.moveTo(width*.5+points[0].x, height*.5+points[0].y);
      for (let index=1; index<points.length; index++) {
        ctx.lineTo(width*.5+points[index].x, height*.5+points[index].y);
      }
      if (segment.clipped) {
        const delta = ((segment.startAngle - segment.endAngle + Math.PI*3) % (Math.PI*2)) - Math.PI;
        ctx.arc(width*.5, height*.5, radius, segment.endAngle, segment.startAngle, delta < 0);
      }
      ctx.closePath();
    });
  };
  const drawLand = () => {
    if (!LAND_FEATURES) return;
    LAND_FEATURES.forEach(({ rings }) => {
      ctx.beginPath();
      rings.forEach(drawRing);
      ctx.fill('evenodd');
      ctx.stroke();
    });
  };

  const draw = now => {
    const dt = Math.min(.05, (now - previousTime) / 1000); previousTime = now;
    if (!dragging) {
      let delta = ((targetLon - lon + 540) % 360) - 180;
      lon += delta * Math.min(1, dt * 3.2);
      lat += (targetLat - lat) * Math.min(1, dt * 3.2);
      if (!selectedId && Math.abs(delta) < .2) targetLon += 7 * dt;
    }
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2;
    const glow = ctx.createRadialGradient(cx-radius*.35, cy-radius*.35, radius*.08, cx, cy, radius*1.12);
    glow.addColorStop(0, '#d7f7ff'); glow.addColorStop(.46, '#58bde9');
    glow.addColorStop(.84, '#1769aa'); glow.addColorStop(1, 'rgba(30,72,120,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius*1.12, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.clip();
    ctx.fillStyle = '#278dcc'; ctx.fillRect(cx-radius, cy-radius, radius*2, radius*2);
    ctx.strokeStyle = 'rgba(232,249,255,.23)'; ctx.lineWidth = 1;
    for (let latitude=-60; latitude<=60; latitude+=30) {
      ctx.beginPath(); let active=false;
      for (let longitude=-180; longitude<=180; longitude+=4) {
        const p=point(latitude,longitude);
        if (!p.visible) { active=false; continue; }
        active ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y); active=true;
      }
      ctx.stroke();
    }
    for (let longitude=-180; longitude<180; longitude+=30) {
      ctx.beginPath(); let active=false;
      for (let latitude=-88; latitude<=88; latitude+=3) {
        const p=point(latitude,longitude);
        if (!p.visible) { active=false; continue; }
        active ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y); active=true;
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#5aa84b'; ctx.strokeStyle = 'rgba(45,90,30,.5)'; ctx.lineWidth = .7;
    drawLand();
    const shade=ctx.createRadialGradient(cx-radius*.38,cy-radius*.42,radius*.15,cx,cy,radius);
    shade.addColorStop(.35,'rgba(255,255,255,.13)'); shade.addColorStop(.78,'rgba(2,31,77,.08)'); shade.addColorStop(1,'rgba(0,12,45,.56)');
    ctx.fillStyle=shade; ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2); ctx.restore();
    ctx.strokeStyle='#2b2b33';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();

    const visible = tracks.map(track => ({ track, p:point(track.lat, track.lon) }))
      .filter(item => item.p.visible).sort((a,b)=>a.p.depth-b.p.depth);
    visible.forEach(({ track, p }) => {
      const selected = track.id === selectedId;
      ctx.fillStyle = selected ? '#ffd23f' : '#fff8e7';
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = selected ? 4 : 2;
      ctx.beginPath(); ctx.arc(p.x,p.y,selected?9:6,0,Math.PI*2);ctx.fill();ctx.stroke();
      if (selected) {
        ctx.font='900 14px "Baloo 2", system-ui, sans-serif';
        const label=trackLocalName(track.id, track.name), tw=ctx.measureText(label).width;
        const lx=Math.max(8,Math.min(width-tw-28,p.x+14)), ly=Math.max(28,p.y-14);
        ctx.fillStyle='#fff8e7';ctx.strokeStyle='#2b2b33';ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(lx-8,ly-18,tw+16,28,9);ctx.fill();ctx.stroke();
        ctx.fillStyle='#2b2b33';ctx.fillText(label,lx,ly+1);
      }
    });
    raf = requestAnimationFrame(draw);
  };

  const markerAt = (x,y) => tracks.map(track => ({ track,p:point(track.lat,track.lon) }))
    .filter(item=>item.p.visible && Math.hypot(item.p.x-x,item.p.y-y)<16)
    .sort((a,b)=>b.p.depth-a.p.depth)[0]?.track;
  canvas.addEventListener('pointerdown', event => {
    dragging=true;moved=false;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx=event.clientX-lastX,dy=event.clientY-lastY;
    if (Math.hypot(dx,dy)>2) moved=true;
    lon-=dx*.32;lat=Math.max(-65,Math.min(65,lat+dy*.25));targetLon=lon;targetLat=lat;
    lastX=event.clientX;lastY=event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    dragging=false;canvas.releasePointerCapture(event.pointerId);
    if (!moved) { const rect=canvas.getBoundingClientRect(),hit=markerAt(event.clientX-rect.left,event.clientY-rect.top); if(hit) onSelect?.(hit.id); }
  });
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); raf=requestAnimationFrame(draw);
  loadLand();
  return {
    setSelected(id) {
      selectedId=id;
      const track=tracks.find(item=>item.id===id);
      if(track){targetLon=track.lon;targetLat=Math.max(-45,Math.min(45,track.lat*.45));}
    },
    destroy(){cancelAnimationFrame(raf);observer.disconnect();}
  };
}
