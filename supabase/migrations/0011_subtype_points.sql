-- Allow a subtype to override its parent waste type's points rate.
-- NULL deliberately means "inherit waste_types.points_per_kg".

alter table app.waste_subtypes
  add column if not exists points_per_kg numeric(10,4)
  check (points_per_kg >= 0);
