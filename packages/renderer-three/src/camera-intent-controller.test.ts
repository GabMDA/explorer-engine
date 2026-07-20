import { describe, it, expect } from 'vitest';
import { createCameraIntentController } from './camera-intent-controller';
import {
  createRenderStateResolver,
  createComponentModel,
  createAnimationEngine,
} from '@explorer-engine/core';
import type {
  CameraPort,
  LayerHandle,
  TransitionSpec,
  Vec3,
  ComponentConfig,
  ResolvedConfig,
} from '@explorer-engine/core';

function comp(id: string, nodes: string[]): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
  };
}

const linear: TransitionSpec = { duration: 1000, easing: 'linear', delay: 0 };

function fakeCamera() {
  let last: { position: Vec3; target: Vec3 } = { position: [0, 0, 0], target: [0, 0, 0] };
  const port: CameraPort = {
    setAspect: () => {},
    setView: (position, target) => (last = { position, target }),
    dispose: () => {},
  };
  return { port, view: () => last };
}

function setup() {
  const model = createComponentModel({
    components: [comp('x', ['n'])],
  } as unknown as ResolvedConfig);
  const resolver = createRenderStateResolver({
    components: model,
    port: { applyNodeStates: () => {} },
  });
  const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
  const cam = fakeCamera();
  const controller = createCameraIntentController({
    resolver,
    camera: cam.port,
    animation: engine,
    transition: linear,
  });
  controller.setHome([0, 0, 10], [0, 0, 0]);
  const setIntent = (position: Vec3, target: Vec3): LayerHandle =>
    resolver.addLayer({
      source: 'focus',
      target: { kind: 'component', id: 'x' },
      channel: 'cameraIntent',
      value: { position, target },
    });
  return { resolver, engine, cam, controller, setIntent };
}

describe('createCameraIntentController', () => {
  it('animates the camera toward the resolved intent and settles', () => {
    const { engine, cam, controller, setIntent } = setup();
    setIntent([0, 0, 2], [0, 0, 0]);
    controller.sync();
    expect(controller.isTransitioning()).toBe(true);

    engine.update(0);
    engine.update(500); // half-way: z between 10 and 2
    expect(cam.view().position[2]).toBeCloseTo(6, 5);

    engine.update(1000);
    expect(cam.view().position[2]).toBeCloseTo(2, 5);
    expect(controller.isTransitioning()).toBe(false); // released → loop can go dormant
  });

  it('returns to the home pose when the intent clears (no imperative restore)', () => {
    const { resolver, engine, cam, controller, setIntent } = setup();
    const h = setIntent([0, 0, 2], [0, 0, 0]);
    controller.sync();
    engine.update(0);
    engine.update(1000); // arrive at intent
    expect(cam.view().position[2]).toBeCloseTo(2, 5);

    resolver.removeLayer(h); // intent gone → recomposition → null
    controller.sync();
    engine.update(1000);
    engine.update(1500); // half-way back: z between 2 and 10
    expect(cam.view().position[2]).toBeCloseTo(6, 5);
    engine.update(2000);
    expect(cam.view().position[2]).toBeCloseTo(10, 5); // home
  });

  it('replaces an in-flight transition when the intent changes', () => {
    const { resolver, engine, cam, controller, setIntent } = setup();
    const h = setIntent([0, 0, 2], [0, 0, 0]);
    controller.sync();
    engine.update(0);
    engine.update(500); // z ≈ 6
    resolver.removeLayer(h);
    setIntent([0, 0, 0], [0, 0, 0]); // new intent
    controller.sync(); // retarget from ≈6 toward 0
    engine.update(1000); // +500 into a fresh 1000ms transition → half-way from 6 → 0
    expect(cam.view().position[2]).toBeCloseTo(3, 5);
  });

  it('does nothing when there is no intent and no home change', () => {
    const { engine, controller } = setup();
    controller.sync(); // no intent, home set but current already == home
    expect(controller.isTransitioning()).toBe(false);
    expect(engine.hasActive).toBe(false);
  });

  it('dispose cancels an active transition', () => {
    const { engine, controller, setIntent } = setup();
    setIntent([0, 0, 2], [0, 0, 0]);
    controller.sync();
    engine.update(0);
    engine.update(300);
    controller.dispose();
    expect(controller.isTransitioning()).toBe(false);
    expect(engine.hasActive).toBe(false);
  });
});
