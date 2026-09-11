# ShapeProject

Tools for working out which reinforcing shapes the factory's machines can make.

## Phase 1: Shape Builder

`shape-builder.html` is a single-file web app. Open it in a browser; nothing to install.
It mirrors the entry flow of a bending machine HMI: length, angle, length, angle, ..., length, cut.
The shape is drawn to scale as it is entered.

### Conventions

- **Leg lengths are outside-to-outside.** Each leg is measured along its outer edge to the
  virtual corner where the outside edges of the two adjacent legs would meet if the bend were sharp.
- **Angles are deflection angles.** 90 is a right angle, 180 is a hook back on itself.
- **Bend direction** is up or down, default up.
- **Bend geometry** comes from bar diameter `d` and pin diameter `p`:
  outside radius `Ro = p/2 + d`, centreline radius `R = p/2 + d/2`.
- **Corner setback** for a bend of angle θ is `Ro·tan(θ/2)`; a 180 hook has no virtual corner and
  uses `Ro`. A leg's straight portion is its entered length minus the setback at each bent end.
  A leg whose length is below the sum of its setbacks is geometrically impossible and is flagged.
- **Developed (cut) length** is the sum of straight portions plus `R·θ` for each bend.
- **Drawing order.** The shape is drawn from the last entered leg heading right, with up bends
  turning anticlockwise, matching the HMI sketch. Rotate and Mirror only change the view.
- Overall width and height are the extents of the bar's outside envelope.

### Shape code

Legs and bends alternate. Bends carry `u` or `d` for direction, `C` marks the cut:

```
250 135d 1000 90u 500 C
```

The URL hash carries the code plus bar and pin diameter, so a link reproduces the shape exactly.

### Parked for later

- Non-planar shapes (a rotation angle per bend) and continuous curves (hoops, spirals).
- Machine capability tables per gauge, and the rules engine that evaluates a shape against them.
