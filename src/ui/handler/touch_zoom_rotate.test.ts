import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../../../rollup/build/tsc/src/ui/map';
import Marker from '../../../../rollup/build/tsc/src/ui/marker';
import DOM from '../../../../rollup/build/tsc/src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
}

test('TouchZoomRotateHandler fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();

    const zoomstart = t.spy();
    const zoom      = t.spy();
    const zoomend   = t.spy();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}, {target, identifier: 2, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -100}, {target, identifier: 2, clientX: 0, clientY: 100}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(1);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -60}, {target, identifier: 2, clientX: 0, clientY: 60}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(2);
    expect(zoomend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart.callCount).toBe(2);
    map._renderTaskQueue.run();
    expect(zoom.callCount).toBe(3);
    expect(zoomend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
    expect(rotatestart.callCount).toBe(0);
    expect(rotate.callCount).toBe(0);
    expect(rotateend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: -50, clientY: 0}, {target, identifier: 1, clientX: 50, clientY: 0}]});
    map._renderTaskQueue.run();
    expect(rotatestart.callCount).toBe(1);
    expect(rotate.callCount).toBe(1);
    expect(rotateend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
    expect(rotatestart.callCount).toBe(1);
    expect(rotate.callCount).toBe(2);
    expect(rotateend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    expect(rotatestart.callCount).toBe(1);
    expect(rotate.callCount).toBe(2);
    expect(rotateend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler does not begin a gesture if preventDefault is called on the touchstart event', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();

    map.on('touchstart', e => e.preventDefault());

    const move = t.spy();
    map.on('move', move);

    simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 5, clientY: 0}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 0, clientY: 5}]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(move.callCount).toBe(0);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler starts zoom immediately when rotation disabled', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();
    map.touchZoomRotate.disableRotation();
    map.handlers._handlersById.tapZoom.disable();

    const zoomstart = t.spy();
    const zoom      = t.spy();
    const zoomend   = t.spy();

    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 5}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 6}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(1);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 4}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(2);
    expect(zoomend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    // incremented because inertia starts a second zoom
    expect(zoomstart.callCount).toBe(2);
    map._renderTaskQueue.run();
    expect(zoom.callCount).toBe(3);
    expect(zoomend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler adds css class used for disabling default touch behavior in some browsers', (t) => {
    const map = createMap(t);

    const className = 'maplibregl-touch-zoom-rotate';
    expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
    map.touchZoomRotate.disable();
    expect(map.getCanvasContainer().classList.contains(className)).toBeFalsy();
    map.touchZoomRotate.enable();
    expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
    t.end();
});

test('TouchZoomRotateHandler zooms when touching two markers on the same map', (t) => {
    const map = createMap(t);

    const marker1 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const marker2 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const target1 = marker1.getElement();
    const target2 = marker2.getElement();

    const zoomstart = t.spy();
    const zoom      = t.spy();
    const zoomend   = t.spy();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
    simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(1);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(1);
    expect(zoom.callCount).toBe(2);
    expect(zoomend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart.callCount).toBe(2);
    map._renderTaskQueue.run();
    expect(zoom.callCount).toBe(3);
    expect(zoomend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler does not zoom when touching an element not on the map', (t) => {
    const map = createMap(t);

    const marker1 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const marker2 = new Marker()
        .setLngLat([0, 0]);

    const target1 = marker1.getElement(); // on map
    const target2 = marker2.getElement(); // not on map

    const zoomstart = t.spy();
    const zoom      = t.spy();
    const zoomend   = t.spy();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.dragPan.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
    simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
    map._renderTaskQueue.run();
    expect(zoomstart.callCount).toBe(0);
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart.callCount).toBe(0);
    map._renderTaskQueue.run();
    expect(zoom.callCount).toBe(0);
    expect(zoomend.callCount).toBe(0);

    map.remove();
    t.end();
});

