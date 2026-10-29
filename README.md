# ShapeProject

Tools for working out which reinforcing shapes the factory's machines can make.

## Phase 1: Shape Builder

`shape-builder.html` is a single-file web app. Open it in a browser; nothing to install.
It takes a shape the way a bending machine's screen does (length, angle, length, angle, ..., length, cut)
and draws the bar to scale as it is entered.

Conventions follow the Shape Definition Standard, IBR-SDS-001 (draft v0.1).

### Conventions

- **Segment lengths are outside-to-outside**, to the intersection of the straight portions at the outside
  of the bend (AS 1100.501) for bends under 90°, and to the outside of the bend for 90° and over. See
  Setback below.
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
  they are production settings. Each bend can carry its own pin (the `pin Ø` field under the angle, blank
  means the header pin); setbacks, straights, cut length, the drawn arc, dimension lines and offsets all
  follow the bend's own radius. Overrides travel in the link (`bp=4:96`) and the JSON, not in the NSS code.
  Lengths stay out-to-out, so changing a bend's pin changes the straight, not the overall: to hold a
  straight, re-enter the length as straight plus the new Ro.
- **Setback.** A bend under 90° dimensions to the virtual corner: setback `Ro·tan(θ/2)` from the end of the
  straight. A bend of 90° or more dimensions each adjoining leg to the furthest point of the bend in that
  leg's direction, which is `Ro` past the end of the straight. A length is never measured to a point that
  is not on the bar, so an obtuse bend's virtual corner (3.2·Ro away at 145°, 7.6·Ro at 165°) is not used.
  The two rules agree at 90°, and the 180 hook is just the second rule. This is the business's convention,
  confirmed on marked-up 120/135/150/165 examples, and it matches the standard's validation offsets, which
  take the outside of the bar for bends over 90°. A segment's straight portion is its length minus the
  setback at each bent end; a segment shorter than the sum of its setbacks is flagged.
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

Both are the same shape rotated. On top of either view the shape can be turned freely: the ⟳ 90° button
steps it, the degree field beside it sets an exact angle (anticlockwise positive), and dragging on the
drawing spins it about its centre, with Shift snapping to 5°. **Lowest** rotates to the orientation with the
smallest overall height, found by rolling the shape's convex hull onto each of its straight edges and
keeping the lowest, narrower on a tie. That is the bundle height, not necessarily a stable rest. The overall
dimensions always report the box at the angle showing. Validation offsets ignore rotation, as the standard
defines them on Segment 1.

The bar is drawn as a hollow outline with later segments in front of earlier ones. Where an earlier part
of the bar lies under a later part, its edges and its end show as dotted hidden lines through the bar in
front.

Hovering a segment length on the drawing shows the dimension it means: a dimension line parallel to the
segment with extension lines at its reference points, the bar end or the virtual corner on the outside of
the adjacent bend. Click the length to pin that dimension line so it stays through rotation,
view, bar and pin changes; click again to release. **All dims** in the toolbar pins every straight segment at
once, for an annotated snapshot. Pins travel in the link (`d=1.3`) and clear when the shape's structure
changes (add, remove, reverse, new shape). Arc segments have no pin; their labels already carry radius,
chord and drop.

The Ruler button measures between any two points on the bar. The cursor snaps to the bar's edges and end
faces, and preferentially to bar-end corners, tangent points, virtual corners and bend apexes. Click two
points to get the straight-line distance with its horizontal and vertical components. Once the first point
is set, dashed guide lines appear through it: horizontal, vertical, and the extension of any straight edge
that ends there. The second point can snap to where a guide crosses any edge or its extension, or anywhere
along a guide, so square distances between points that don't line up can be measured. While a point is
being placed, dashed horizontal and vertical lines through the snap candidate show its alignment, and if
it sits off the bar on an edge's extension, that edge line too. The second point also snaps to where a
guide from the first point crosses the vertical or horizontal through any key point on the bar, with a
dotted tracking line from that key point, so a point directly below a hook tip or level with a corner can be
picked even though nothing is drawn there. Once both points are set the measurement
is shown ordinate-style: verticals and horizontals through both points, the horizontal component
dimensioned across the top between the verticals, the vertical component at the side, and the direct
distance on the diagonal. Escape clears.

**Adjust** puts a blue handle on the outside of every bend, for drawings that leave an angle out: drag a
handle and the bar after the bend (in walking order, so from the start of bar in Standard and from the last
segment in Machine) swings to point at the cursor, the outgoing straight lying on the tangent from the cursor
to the bend. Angles step in whole degrees, from 0 to 180, and dragging through straight flips the bend up or
down. The drawing holds its scale and position during the drag so the handle stays under the cursor, and
refits on release; the overall dimensions, stats and table update live. Click a handle and the arrow keys
nudge it ±1°, Shift ±0.1°; Escape deselects. Dragging off a handle still rotates the view. Adjust and the
Ruler are exclusive.

### Shape code (NSS)

```
l250,w-135,l1000,w90,l500
l220,w180,l1000,w-180,l220        180 hooks each end
l220,w90,r5000,l5000,w0,l1000     90 cog, arc R5000 of length 5000, tangent join, straight 1000
```

`l` segment length, `w` bend angle (signed), `r` radius before an arc segment, `w0` a tangent join.
The earlier space-separated form (`250 135d 1000 90u 500 C`) still loads.
The URL hash carries the code, bar and pin diameter, the view and any rotation, so a link reproduces the shape exactly.

### Parked for later

- Non-planar shapes (a rotation angle per bend). The standard lists 3D input as a future item.
- Machine capability rules per model and gauge, captured by clicking segments and bends on a shape,
  and the pass/fail/no-data view per machine that follows from them.
