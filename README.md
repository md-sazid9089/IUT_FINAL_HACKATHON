# Vantage Arm Lab

## Browser-Based Robotic Arm Digital Twin & Software-In-The-Loop Validation Platform

## Overview

Vantage Arm Lab is a browser-based robotic arm simulation and validation
platform designed to verify robotic control software before deployment
to real industrial hardware.

The system creates a complete digital twin environment where engineers
can:

-   Visualize a 6-DOF robotic arm using URDF
-   Control the robot manually
-   Test inverse kinematics
-   Execute voice commands
-   Perform autonomous PIN entry
-   Validate motion safety
-   Demonstrate future hardware integration

The core principle:

> Every input source uses one trusted motion-control pipeline.

Architecture:

Input → Command Validation → Safety Supervisor → IK → Motion Planning →
Runtime → Digital Twin

------------------------------------------------------------------------

# Problem Statement Alignment

Industrial robotic software testing directly on hardware is:

-   Slow
-   Expensive
-   Risky

This project provides a simulation-first validation platform where
robotic motion software can be tested safely before reaching physical
robots.

The implementation covers:

-   Phase 1: See The Arm
-   Phase 2: Move The Arm
-   Phase 3: Talk To The Arm
-   Phase 4: Autonomous PIN Entry
-   Phase 5: Electrical Proof Of Concept

------------------------------------------------------------------------

# Core Features

## 1. 3D Robotic Digital Twin

Technologies:

-   React
-   TypeScript
-   Three.js
-   React Three Fiber
-   URDF Loader

Features:

-   URDF robot loading
-   Real-time 3D visualization
-   Joint state display
-   End-effector tracking
-   Camera controls
-   Key panel visualization

------------------------------------------------------------------------

# 2. Robotics Core

The robotics engine contains:

## Forward Kinematics

Calculates:

-   Joint transformations
-   End-effector position
-   Tool orientation

## Inverse Kinematics

Implemented using:

-   Jacobian based solving
-   Damped Least Squares optimization
-   Joint limit protection
-   Reachability checking

## Motion Planning

Supports:

-   Cartesian movement
-   Joint interpolation
-   Smooth trajectories
-   Safe approach and retract motion

------------------------------------------------------------------------

# 3. Unified Control Pipeline

All control methods use the same architecture.

Supported inputs:

-   Dashboard controls
-   GUI joystick
-   Keyboard
-   Voice commands
-   Autonomous PIN execution
-   Optional AI commands

Flow:

Input Adapter

↓

Command Normalization

↓

Schema Validation

↓

Safety Supervisor

↓

IK Solver

↓

Trajectory Generator

↓

Robot Runtime

↓

3D Simulation

------------------------------------------------------------------------

# 4. Manual Control

## Joystick Control

Provides:

-   X movement
-   Y movement
-   Z movement
-   Precision mode
-   Cartesian jogging

## Keyboard Control

Supports:

-   Direction movement
-   Speed control
-   Precision mode
-   Emergency stop

------------------------------------------------------------------------

# 5. Voice Control

The system supports natural voice commands.

Examples:

-   Move up
-   Move left 5 centimeters
-   Rotate base 30 degrees
-   Press key five
-   Enter PIN 123456

Voice pipeline:

Speech Input

↓

Command Parser

↓

Structured Robot Command

↓

Safety Validation

↓

Execution

------------------------------------------------------------------------

# 6. Autonomous PIN Entry

The robotic arm can automatically enter a six-digit PIN.

Execution:

1.  Validate PIN
2.  Check key coordinates
3.  Calculate motion path
4.  Move to hover position
5.  Descend stylus
6.  Verify key contact
7.  Retract safely
8.  Continue sequence

Validation:

-   Position error measurement
-   Reachability checking
-   Joint limit checking
-   Execution reporting

------------------------------------------------------------------------

# 7. Safety System

Every movement passes through safety validation.

Checks:

-   Command format
-   Workspace limits
-   Joint limits
-   Reachability
-   Emergency stop state
-   Motion constraints

Unsafe commands are rejected before execution.

------------------------------------------------------------------------

# 8. Agentic Voice Extension

Optional AI extension:

User:

"Move slightly toward the panel and press key five twice."

AI converts:

Natural language

↓

Structured motion commands

↓

Safety validation

↓

Robot execution

Important:

AI never directly controls the robot.

All AI-generated commands must pass deterministic safety checks.

------------------------------------------------------------------------

# Hardware Proof Of Concept

Future hardware architecture:

Browser Dashboard

↓

Wi-Fi Communication

↓

ESP32 Controller

↓

PCA9685 Servo Driver

↓

6 Servo Motors

Includes:

-   Servo power planning
-   Communication design
-   Emergency stop concept
-   Hardware expansion path

------------------------------------------------------------------------

# Technology Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   Three.js
-   React Three Fiber
-   Zustand
-   Zod
-   Tailwind CSS

## Robotics

-   URDF Loader
-   gl-matrix
-   Custom kinematics engine
-   Web Worker based IK solver

## Testing

-   Vitest
-   React Testing Library
-   Playwright
-   GitHub Actions

------------------------------------------------------------------------

# Project Structure

src/

-   core/
    -   commands
    -   kinematics
    -   planning
    -   runtime
    -   safety
-   robot/
    -   URDF adapter
    -   robot profiles
-   scene/
    -   robot visualization
    -   keypad rendering
-   controls/
    -   joystick
    -   keyboard
    -   voice
-   workers/
    -   IK worker
-   ui/
    -   dashboard
    -   telemetry

docs/

-   architecture
-   testing
-   electrical design
-   demo plan

------------------------------------------------------------------------

# Installation

Requirements:

-   Node.js
-   npm
-   Git

Install dependencies:

npm install

Run development server:

npm run dev

Production build:

npm run build

------------------------------------------------------------------------

# Testing

Before release:

npm run typecheck

npm run lint

npm run test

npm run build

------------------------------------------------------------------------

# Demo Presentation Flow

## Step 1

Show robotic digital twin.

Demonstrate:

-   URDF loading
-   Joint telemetry
-   Key panel

## Step 2

Demonstrate:

-   Joystick control
-   Keyboard control

## Step 3

Demonstrate:

-   Voice command execution

## Step 4

Enter PIN:

123456

Show:

-   Autonomous planning
-   Key pressing
-   Accuracy report

## Step 5

Demonstrate:

-   Safety rejection
-   Architecture explanation

------------------------------------------------------------------------

# Hackathon Requirement Mapping

  Requirement          Implementation
  -------------------- ------------------------
  URDF Visualization   Three.js + URDF Loader
  Live Dashboard       Telemetry System
  Inverse Kinematics   DLS IK Solver
  Joystick             Cartesian Controller
  Keyboard             Keyboard Adapter
  Voice                Speech Command Parser
  PIN Automation       Autonomous Planner
  Electrical Design    ESP32 Architecture
  Safety               Validation Pipeline

------------------------------------------------------------------------

# Engineering Philosophy

Different interfaces.

One trusted robotics pipeline.

The platform is designed so that future hardware integration requires
replacing only the robot adapter layer while keeping:

-   Controls
-   Safety
-   Planning
-   Validation
-   User interfaces

unchanged.

------------------------------------------------------------------------

# Future Improvements

-   Real robotic arm connection
-   ROS integration
-   Computer vision control
-   Advanced collision avoidance
-   Multi robot simulation
-   AI robotic assistant

------------------------------------------------------------------------
