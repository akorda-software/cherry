/**
 * react-native-svg mock for jsdom tests.
 * Maps SVG primitives to their HTML equivalents so render passes succeed.
 */
import { createElement as h, forwardRef } from "react";

function createSvgComponent(tag: string, displayName: string) {
  const Comp = forwardRef<any, any>((props, ref) => h(tag, { ...props, ref }));
  Comp.displayName = displayName;
  return Comp;
}

const Svg = createSvgComponent("svg", "Svg");
const Path = createSvgComponent("path", "Path");
const G = createSvgComponent("g", "G");
const Circle = createSvgComponent("circle", "Circle");
const Rect = createSvgComponent("rect", "Rect");
const Defs = createSvgComponent("defs", "Defs");
const ClipPath = createSvgComponent("clipPath", "ClipPath");
const LinearGradient = createSvgComponent("linearGradient", "LinearGradient");
const Stop = createSvgComponent("stop", "Stop");
const Pattern = createSvgComponent("pattern", "Pattern");
const Ellipse = createSvgComponent("ellipse", "Ellipse");
const Line = createSvgComponent("line", "Line");
const Polygon = createSvgComponent("polygon", "Polygon");
const RadialGradient = createSvgComponent("radialGradient", "RadialGradient");
const Mask = createSvgComponent("mask", "Mask");
const SvgText = createSvgComponent("text", "Text");
const TSpan = createSvgComponent("tspan", "TSpan");

export default Svg;
export { Svg, Path, G, Circle, Rect, Defs, ClipPath, LinearGradient, Stop };
export { Pattern, Ellipse, Line, Polygon, RadialGradient, Mask, SvgText as Text, TSpan };
