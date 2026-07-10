import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { getRuntime } from '../runtime/runtimeInstance';
import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import {
    DEFAULT_DEAD_ZONE,
    manualJogGate,
    type SpeedMode,
} from './jogModel';

type JointVector2 = [number, number];

const JOINT_STEP_RADIANS: Record<SpeedMode, number> = {
    precision: 0.003,
    normal: 0.01,
    fast: 0.025,
};

/**
 * Commands are generated 20 times per second while the joystick is held.
 */
const UPDATE_RATE_HZ = 20;

export interface JointJoystickStatus {
    readonly vector: JointVector2;
    readonly speedMode: SpeedMode;
    readonly joint1Delta: number;
    readonly joint2Delta: number;
    readonly lastRejection: string | null;
}

export interface JointJoystickControls {
    readonly status: JointJoystickStatus;

    readonly setJoystick: (
        x: number,
        y: number,
    ) => void;

    readonly releaseJoystick: () => void;

    readonly setSpeedMode: (
        mode: SpeedMode,
    ) => void;

    readonly home: () => void;
    readonly stop: () => void;
    readonly estop: () => void;
}

function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(
        maximum,
        Math.max(minimum, value),
    );
}

export function useJointJoystick(): JointJoystickControls {
    const joystick = useRef<JointVector2>([0, 0]);
    const speedModeRef = useRef<SpeedMode>('normal');

    const [status, setStatus] = useState<JointJoystickStatus>({
        vector: [0, 0],
        speedMode: 'normal',
        joint1Delta: 0,
        joint2Delta: 0,
        lastRejection: null,
    });

    const publishStatus = useCallback(
        (
            joint1Delta = 0,
            joint2Delta = 0,
            rejection: string | null = null,
        ) => {
            setStatus({
                vector: [
                    joystick.current[0],
                    joystick.current[1],
                ],
                speedMode: speedModeRef.current,
                joint1Delta,
                joint2Delta,
                lastRejection: rejection,
            });
        },
        [],
    );

    const setJoystick = useCallback(
        (x: number, y: number) => {
            const magnitude = Math.hypot(x, y);

            if (
                !Number.isFinite(magnitude) ||
                magnitude <= DEFAULT_DEAD_ZONE
            ) {
                joystick.current = [0, 0];
            } else if (magnitude > 1) {
                joystick.current = [
                    x / magnitude,
                    y / magnitude,
                ];
            } else {
                joystick.current = [x, y];
            }

            publishStatus();
        },
        [publishStatus],
    );

    const releaseJoystick = useCallback(() => {
        joystick.current = [0, 0];
        publishStatus();
    }, [publishStatus]);

    const setSpeedMode = useCallback(
        (mode: SpeedMode) => {
            speedModeRef.current = mode;
            publishStatus();
        },
        [publishStatus],
    );

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            const [x, y] = joystick.current;

            if (x === 0 && y === 0) {
                return;
            }

            const runtimeSnapshot =
                useRuntimeStore.getState().snapshot;

            const runtimeState =
                runtimeSnapshot?.state ?? 'BOOTING';

            const activeSource =
                runtimeSnapshot?.activeCommand?.source ?? null;

            const gate = manualJogGate(
                runtimeState,
                activeSource,
            );

            if (gate.status === 'blocked') {
                publishStatus(
                    0,
                    0,
                    gate.reason ?? 'Joint joystick is blocked',
                );

                return;
            }

            if (gate.status === 'busy') {
                return;
            }

            const jointValues =
                runtimeSnapshot?.jointValues ?? {};

            const robotState =
                useRobotStore.getState();

            const joint1Meta = robotState.jointMeta.find(
                (joint) => joint.name === 'joint_1',
            );

            const joint2Meta = robotState.jointMeta.find(
                (joint) => joint.name === 'joint_2',
            );

            if (!joint1Meta || !joint2Meta) {
                publishStatus(
                    0,
                    0,
                    'joint_1 or joint_2 metadata is unavailable',
                );

                return;
            }

            const currentJoint1 =
                jointValues.joint_1 ?? 0;

            const currentJoint2 =
                jointValues.joint_2 ?? 0;

            const maximumStep =
                JOINT_STEP_RADIANS[speedModeRef.current];

            /**
             * Horizontal joystick controls joint_1.
             *
             * Right = positive joint_1
             * Left  = negative joint_1
             */
            const joint1Delta = x * maximumStep;

            /**
             * Vertical joystick controls joint_2.
             *
             * Up   = positive joint_2
             * Down = negative joint_2
             */
            const joint2Delta = y * maximumStep;

            const targetJoint1 = clamp(
                currentJoint1 + joint1Delta,
                joint1Meta.lower,
                joint1Meta.upper,
            );

            const targetJoint2 = clamp(
                currentJoint2 + joint2Delta,
                joint2Meta.lower,
                joint2Meta.upper,
            );

            getRuntime()?.submit({
                type: 'move_joints',
                source: 'joystick',
                joints: {
                    joint_1: targetJoint1,
                    joint_2: targetJoint2,
                },
            });

            publishStatus(
                targetJoint1 - currentJoint1,
                targetJoint2 - currentJoint2,
                null,
            );
        }, 1000 / UPDATE_RATE_HZ);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [publishStatus]);

    useEffect(() => {
        const clearInput = () => {
            joystick.current = [0, 0];
            publishStatus();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                clearInput();
            }
        };

        window.addEventListener('blur', clearInput);

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange,
        );

        return () => {
            window.removeEventListener('blur', clearInput);

            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );

            joystick.current = [0, 0];
        };
    }, [publishStatus]);

    return {
        status,
        setJoystick,
        releaseJoystick,
        setSpeedMode,

        home: useCallback(() => {
            getRuntime()?.submit({
                type: 'home',
                source: 'joystick',
            });
        }, []),

        stop: useCallback(() => {
            joystick.current = [0, 0];
            publishStatus();

            getRuntime()?.submit({
                type: 'stop',
                source: 'system',
            });
        }, [publishStatus]),

        estop: useCallback(() => {
            joystick.current = [0, 0];
            publishStatus();

            getRuntime()?.submit({
                type: 'estop',
                source: 'system',
            });
        }, [publishStatus]),
    };
}

export {
    JOINT_STEP_RADIANS,
};