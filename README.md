# ShapeProject

Tools for working out which reinforcing shapes the factory's machines can make.

## Phase 1: Shape Builder

`shape-builder.html` is a single-file web app. Open it in a browser; nothing to install.
It takes a shape the way a bending machine's screen does (length, angle, length, angle, ..., length, cut)
and draws the bar to scale as it is entered.

Conventions follow the Shape Definition Standard, IBR-SDS-001 (draft v0.1).

### Conventions

- **Segment lengths are outside-to-outside**, to the intersection of the straight portions at the outside
  of the bend (AS 1100.501). A 180 hook has no intersection and is measured to the outside of the bend.
- **Bend angle is the outside angle** (deflection). 90 is a right angle, 180 is a hook back on itself.
- **Bend direction** is up or down on screen, default up. In the shape code and JSON the angle is signed:
  clockwise positive, anticlockwise negative, walking from the start of bar with Segment 1 on the X axis.
  Up maps to positive. This mapping was derived from the machine-screen sketch and the standard's hook
  example; confirm it against a real machine before relying on it for direction-sensitive rules.
- **Start and end treatments.** An end segment is treated as a hook or cog when its bend is 90 or more and
  it is shorter than the segment it joins. Segment 1 is the first segment that is not a treatment.
  This is a heuristic; replace it if the business writes a rule.
- **Actual bar diameter.** All geometry uses the over-ribs diameter of the deformed bar, not the nominal
  size: by default nominal × 1.15 (rib height 7.5% of nominal each side, the middle of the 5 to 10% tolerance),
  so N20 is 23 mm. The Actual Ø field overrides it. This matches the scheduling software, which was
  verified on an N20 arc: outside radius 750, cut length 1159, chord 1060, drop 219. The nominal size
  still labels the bar and sets the default pin.
- **Bend geometry** comes from actual bar diameter `d` and pin diameter `p`:
  outside radius `Ro = p/2 + d`, centreline radius `R = p/2 + d/2`. The standard does not cover these;
  they are production settings.
- **Corner setback** for a bend of angle θ is `Ro·tan(θ/2)`; a 180 hook uses `Ro`. A segment's straight
  portion is its length minus the setback at each bent end. A segment shorter than the sum of its setbacks
  is geometrically impossible and is flagged.
- **Length overall** is the sum of segment lengths, per the standard. **Cut length** is the sum of straight
  portions plus centreline arc length at each bend.
- **Validation offsets** (standard section 4.2): Segment 1 on the straight edge, X along it and Y off it,
  from the bend at the end of Segment 1 to each later bend. For bends of 90 or less the point is the
  virtual corner; for bends over 90 it is the outside of the bar. Hooks and cogs get none.
- **Arc segments** (radius bends, rings, arches). The ⌒ button on a segment row makes it an arc. The row's
  length becomes the cut length (centreline) and a sub-row takes the outside radius and a direction. Chord,
  drop and angle are calculated, shown beside the radius, listed in the stats, and drawn on the shape in
  green with the chord as a dashed line and the drop as a dimension to the apex. Chord and drop are both on
  the outside face: the chord between the arc's ends, the drop from that chord line to the apex. Adjacent straights are dimensioned to the tangent points. A ring is an arc whose angle comes
  out at 360. The code carries the standard's centreline `r` and cut length `l`.

### Views

- **Standard** (default): start of bar at the left, Segment 1 on the X axis. If Segment 1 is an arc, its
  chord is on the X axis. This is what the standard specifies for MES displays and operator documents.
- **Machine**: last segment flat, drawn as the machine screen draws it.

Both are the same shape rotated. Rotate turns the view in 90° steps.

The bar is drawn as a hollow outline with later segments in front of earlier ones. Where an earlier part
of the bar lies under a later part, its edges and its end show as dotted hidden lines through the bar in
front.

Hovering a segment length on the drawing shows the dimension it means: a dimension line parallel to the
segment with extension lines at its reference points, the bar end or the virtual corner on the outside of
the adjacent bend.

The Ruler button measures between any two points on the bar. The cursor snaps to the bar's edges and end
faces, and preferentially to bar-end corners, tangent points, virtual corners and bend apexes. Click two
points to get the straight-line distance with its horizontal and vertical components. Once the first point
is set, dashed guide lines appear through it: horizontal, vertical, and the extension of any straight edge
that ends there. The second point can snap to where a guide crosses any edge or its extension, or anywhere
along a guide, so square distances between points that don't line up can be measured. While a point is
being placed, dashed lines through the snap candidate show what it is sitting on: the guide it is on and
the line of any straight edge it is on. Escape clears.

### Shape code (NSS)

```
l250,w-135,l1000,w90,l500
l220,w180,l1000,w-180,l220        180 hooks each end
l220,w90,r5000,l5000,w0,l1000     90 cog, arc R5000 of length 5000, tangent join, straight 1000
```

`l` segment length, `w` bend angle (signed), `r` radius before an arc segment, `w0` a tangent join.
The earlier space-separated form (`250 135d 1000 90u 500 C`) still loads.
The URL hash carries the code, bar and pin diameter, and the view, so a link reproduces the shape exactly.

### Parked for later

- Non-planar shapes (a rotation angle per bend). The standard lists 3D input as a future item.
- Machine capability rules per model and gauge, captured by clicking segments and bends on a shape,
  and the pass/fail/no-data view per machine that follows from them.
