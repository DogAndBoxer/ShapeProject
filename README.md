# ShapeProject

Tools for working out which reinforcing shapes the factory's machines can make.

## Phase 1: Shape Builder

`shape-builder.html`, with `shared.js` beside it. Open it in a browser; nothing to install.
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

### Shape code (NSS)

```
l250,w-135,l1000,w90,l500
l220,w180,l1000,w-180,l220        180 hooks each end
l220,w90,r5000,l5000,w0,l1000     90 cog, arc R5000 of length 5000, tangent join, straight 1000
```

`l` segment length, `w` bend angle (signed), `r` radius before an arc segment, `w0` a tangent join.
The earlier space-separated form (`250 135d 1000 90u 500 C`) still loads.
The URL hash carries the code, bar and pin diameter, the view and any rotation, so a link reproduces the shape exactly.

## Phase 2: Shape audit

Open `index.html`. It is the audit home; the Shape Builder is one of its sections. Three files, no build step:
`index.html`, `shape-builder.html` and `shared.js`.

The aim is a database of what each machine on the floor can make, built by operators at the machines, and
from it a check that says whether a hypothetical shape can be made on at least one machine.

### The idea

A minimum belongs to a segment and depends only on the bend at each end of it, the order those two bends are
made in, the bar and the pin. So every shape breaks down into a fixed set of **primitives**:

| Primitive | Meaning | Count |
|---|---|---|
| `lead-A` | free end, then the first bend made | 4 |
| `tail-A` | the last bend made, then the cut (the machine can draw the wire back, so this differs from the lead) | 4 |
| `int-s-A-B` | segment between bend A (made first) and bend B (made second), turning the same way | 16 |
| `int-o-A-B` | the same, turning opposite ways | 16 |

A and B are 45, 90, 135 or 180. A pin is its diameter and its profile (round, hoe-like, shark fin); a 64 round
and a 64 hoe-like are separate pins. One pin per piece. Minimums are the same up or down.

### Audit pieces

The operator is not given lengths. Each piece is a shape with its angles fixed; the operator makes it as short
as the machine will go and enters what was achieved. One piece therefore gives a minimum for every segment in
it, so the 40 primitives are covered by 36 pieces per bar and pin:

- `p1-A`: one bend. Gives `lead-A` and `tail-A`.
- `p2-s-A-B`, `p2-o-A-B`: two bends, A made first. Gives `lead-A`, the segment between, and `tail-B`.

Plus **composites**, whole shapes whose limit is not between two bends (on a tight closed tie it is the bent
bar coming back round behind the pin): `tie-sq-135` is built in, more go in `BUILTIN` in `shared.js`. And
**added shapes**: draw anything in the Shape Builder and use **Add to audit**.

### Rings and arcs

- **Radius machines** make plain rings only. They have no pins and no pieces: the audit is one form with the
  smallest ring's outside diameter for each bar diameter.
- **Rings with hooks** at 90°, 145° and 180° (`l200,w90,r393,l3000,w90,l200`: hook, bend, a ring that laps
  itself, the same bend, the same hook, all turning the same way) are built-in pieces for benders marked
  **Makes rings with hooks**. The operator enters the smallest outside diameter and the hook length; both
  hooks are the same. These are kept apart from the straight-shape primitives.
- **Any other shape with an arc** is not audited and cannot be added: arcs with bends are evaluated case by
  case.

Getting one segment to its minimum can stop another reaching its own. **Save and add a version** records
another combination of the same piece. A primitive's minimum is the shortest that segment reached in any
version.

### Sections

- **Home**: overall and per-machine progress, operator name, and Start or Continue audit for each machine.
- **Perform the audit** (`shape-builder.html?audit=<machine>`): the builder with angles, directions and
  structure locked. Segments not yet entered are drawn at a nominal length and labelled `?`. Enter moves
  through the lengths and saves on the last one. Skip for now sends the piece to the back of the queue;
  Can't make records that the machine cannot do it, with a reason. The queue runs bar diameter outermost,
  then pin, then piece, to keep changeovers down. Added shapes can be marked as bent from the end.
- **Machines**: name, type (bender or radius machine), bar or coil, diameters, and for a bender its pins
  (diameter and profile), which bar runs on which pin, whether it makes rings with hooks, and whether it can
  reverse bend (recorded, not used yet).
- **Shapes**: the built-in pieces and the added ones.
- **Review data**: every saved piece. Void takes a record out of the minimums and puts its piece back in the
  queue.
- **Findings**: minimums by machine for a bar and pin, pieces with more than one version and the spread
  between them, smallest rings, rings with hooks, and the Can't make list.
- **Settings**: database connection, export and import.

### Machine check (in the Shape Builder)

Under the stats. For each machine with audit data for the shape's bar and pin diameter, the shape is checked
in both feed orders (bent from the start of bar, bent from the end), since the order decides which end is the
lead, which is the tail, and which bend of each pair comes first. Each segment is **Pass** at or above the
audited minimum, **Under minimum** below it, and **Unknown** where nothing has been audited.

Minimums are held as straights (tangent to tangent), worked out with the audited piece's own bar and pin,
then shown as segment lengths for the shape. Angles between the four are interpolated on the straight and
marked as interpolated. Bends under 45° and shapes with per-bend pins come out Unknown.

Shapes with an arc are handled separately. A single arc or ring is checked against each radius machine's
smallest ring for that bar (a partial arc is checked against the full-ring figure, which may not hold for a
short arc). A ring with 90°, 145° or 180° hooks is checked for diameter and hook length on the benders audited
for it. Anything else with an arc gets no verdict.

Limits to keep in mind:

- The check is per segment. Where a minimum comes from a piece with more than one version it is flagged as a
  trade-off: it may not hold with the neighbouring segments at their own minimums.
- Collisions with the machine or with the bar itself are not checked, and composites are recorded but not
  used by the check.

### Storage

Everything is saved in the browser first, so the audit works with no connection. The Supabase project URL and
publishable key are built into `shared.js` (Settings can override them per laptop); each change is pushed and
everything is pulled, newest copy of each record winning. Run `supabase/schema.sql` in the project once; it creates three tables (`shape_machines`,
`shape_shapes`, `shape_audits`) and two flat views for export (`shape_audit_records`, `shape_machine_list`).
The anon key has read, insert and update on those tables with no login. Nothing is hard-deleted.

Browser storage belongs to the address the app is opened from, so serve the three files from one place
(any static host) rather than opening them from different folders.

### Parked for later

- Rules export for scheduling and detailing, and a rule for trade-offs between neighbouring segments once the
  audit shows how large they are.
- What reverse bend and bar versus coil change in the audit.
- Machine face and pin outlines as collision shapes, for maximums and closed-shape clearance.

- Non-planar shapes (a rotation angle per bend). The standard lists 3D input as a future item.
- Machine capability rules per model and gauge, captured by clicking segments and bends on a shape,
  and the pass/fail/no-data view per machine that follows from them.
