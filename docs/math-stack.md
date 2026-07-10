# Locked Math Stack

## Spatial mathematics

Use `gl-matrix`, configured for `Float64Array`, for:

- vectors
- quaternions
- 3×3 and 4×4 transforms
- URDF origin transforms
- axis-angle rotations
- point and direction transforms

Wrap library calls behind project-owned functional modules.

## DLS linear algebra

Implement a small project-specific functional layer using preallocated `Float64Array` workspaces.

Required operations:

- task weighting
- `J Jᵀ`
- diagonal damping
- Cholesky factorization
- forward/back substitution
- `Jᵀ y`
- vector norms
- finite-value validation
- condition/singularity diagnostics

Do not implement a general matrix inverse.

## URDF transform rule

For active or locked revolute joints:

```text
T = T_origin × R(axis, q)
```

For fixed joints:

```text
T = T_origin
```

A locked revolute joint remains revolute and remains in the chain.

## URDF RPY convention

Under the chosen column-vector convention:

```text
R = Rz(yaw) × Ry(pitch) × Rx(roll)
```

Add isolated and combined RPY tests.

## Verification

Custom FK must match the independent Three.js/URDF transform:

- position error ≤ 0.0001 m
- orientation error ≤ 0.0001 rad
- tool-axis dot ≥ 0.999999

These are acceptance tolerances, not claims of absolute mathematical certainty.
