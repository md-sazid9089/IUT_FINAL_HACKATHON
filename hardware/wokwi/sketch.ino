#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <ESP32Servo.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ============================================================
// IUT Hackathon Robot Arm - Complete Wokwi Circuit Simulation
//
// Functional features:
// - Six official arm-joint servo channels
// - Four-button joystick: UP / DOWN / LEFT / RIGHT
// - Manual and autonomous control modes
// - Precision / Normal / Fast speed profiles
// - Smooth minimum-jerk servo interpolation
// - Native Wokwi 4x4 manual PIN keypad
// - Digits 1-6, MODE, HOME, CLEAR, SPEED, ENTER, RESUME
// - Six key-panel indicator LEDs
// - OLED telemetry
// - Wi-Fi status
// - Latched emergency stop and explicit resume
// - Home button, self-test, joint limits, structured events
//
// Wokwi reliability choice:
// The virtual servos are driven directly from ESP32 PWM pins.
// The final real-hardware schematic should use:
// ESP32 -> I2C -> PCA9685 -> Servos
// with a separate regulated high-current servo power supply.
// ============================================================

constexpr uint8_t NUM_SERVOS = 6;
constexpr uint8_t OFFICIAL_ARM_SERVOS = 6;
constexpr uint8_t SERVO_PINS[NUM_SERVOS] = {
  13, 14, 16, 17, 25, 26
};

constexpr uint8_t JOY_UP_PIN = 4;
constexpr uint8_t JOY_DOWN_PIN = 5;
constexpr uint8_t JOY_LEFT_PIN = 12;
constexpr uint8_t JOY_RIGHT_PIN = 23;

constexpr uint8_t ESTOP_BUTTON_PIN = 32;

// Native Wokwi 4x4 membrane keypad, scanned manually.
// GPIO34/35/36/39 are input-only and do not support internal
// pull-ups, so diagram.json supplies four external 10k pull-ups.
// This scanner uses pinMode(INPUT), never INPUT_PULLUP, removing
// the ESP32 gpio_pullup_en errors produced by the Keypad library.
constexpr uint8_t KEYPAD_ROWS = 4;
constexpr uint8_t KEYPAD_COLS = 4;
constexpr char KEYPAD_NO_KEY = '\0';

const char KEYPAD_KEYS[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1', '2', '3', 'A'},  // A = MODE
  {'4', '5', '6', 'B'},  // B = HOME
  {'7', '8', '9', 'C'},  // C = CLEAR
  {'*', '0', '#', 'D'}   // *=SPEED, #=ENTER, D=RESUME
};

constexpr uint8_t KEYPAD_ROW_PINS[KEYPAD_ROWS] = {
  34, 35, 36, 39
};

constexpr uint8_t KEYPAD_COL_PINS[KEYPAD_COLS] = {
  0, 15, 27, 33
};
constexpr uint8_t SHIFT_DATA_PIN = 18;
constexpr uint8_t SHIFT_CLOCK_PIN = 19;
constexpr uint8_t SHIFT_LATCH_PIN = 2;

constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;

constexpr int SERVO_MIN_US = 500;
constexpr int SERVO_MAX_US = 2400;

constexpr uint16_t PRESS_HOLD_MS = 250;
constexpr uint32_t WIFI_TIMEOUT_MS = 8000;
constexpr uint8_t REQUIRED_PIN_LENGTH = 6;
constexpr uint16_t KEYPAD_DEBOUNCE_MS = 45;

constexpr uint8_t KEY_LED_BITS[6] = {0, 1, 2, 3, 4, 5};
constexpr uint8_t READY_LED_BIT = 6;
constexpr uint8_t STOP_LED_BIT = 7;

constexpr int JOINT_MIN[NUM_SERVOS] = {
  15, 20, 15, 10, 10, 10
};

constexpr int JOINT_MAX[NUM_SERVOS] = {
  165, 160, 165, 170, 170, 170
};

constexpr int HOME_POSE[NUM_SERVOS] = {
  90, 85, 95, 90, 90, 90
};

// Representative firmware-level approach poses.
// The browser URDF/IK application will later calculate exact
// Cartesian solutions from the official key coordinates.
constexpr int KEY_APPROACH_POSES[6][NUM_SERVOS] = {
  {58, 70, 110, 92, 98, 88}, // Key 1
  {74, 70, 110, 92, 98, 88}, // Key 2
  {90, 70, 110, 92, 98, 88}, // Key 3
  {58, 100, 82, 88, 82, 92}, // Key 4
  {74, 100, 82, 88, 82, 92}, // Key 5
  {90, 100, 82, 88, 82, 92}  // Key 6
};

const char* JOINT_NAMES[NUM_SERVOS] = {
  "J1 Base",
  "J2 Shoulder",
  "J3 Elbow",
  "J4 Wrist Roll",
  "J5 Wrist Pitch",
  "J6 Tool Roll"
};

enum class ControlMode : uint8_t {
  MANUAL,
  AUTO
};

enum class SpeedMode : uint8_t {
  PRECISION,
  NORMAL,
  FAST
};

Servo servos[NUM_SERVOS];
Adafruit_SSD1306 display(128, 64, &Wire, -1);

ControlMode controlMode = ControlMode::MANUAL;
SpeedMode speedMode = SpeedMode::NORMAL;

bool displayAvailable = false;
bool wifiConnected = false;
bool emergencyLatched = false;
bool motionBusy = false;
bool autonomousActive = false;
bool manualJogActive = false;

int currentAngles[NUM_SERVOS] = {
  90, 85, 95, 90, 90, 90
};

uint8_t keyLedMask = 0;

String serialBuffer;
String pendingCommand;
bool pendingCommandAvailable = false;

// Manual keypad input buffer. Digits are entered one at a time.
// CLEAR resets the buffer. ENTER starts motion only when exactly
// six valid digits have been entered.
String keypadPinBuffer = "";
char keypadLastRawKey = KEYPAD_NO_KEY;
char keypadStableKey = KEYPAD_NO_KEY;
unsigned long keypadLastChangeMs = 0;

unsigned long lastJoystickStepMs = 0;
String lastJoystickDirection = "IDLE";


// ------------------------------------------------------------
// Forward declarations
// ------------------------------------------------------------
void updateDisplay(
  const String& action,
  const String& detail1 = "",
  const String& detail2 = ""
);

void emitEvent(
  const String& type,
  const String& payload = ""
);

void printHelp();
void printStatus();

void serviceSerial(bool duringMotion);
void serviceSafety(bool duringMotion);
void serviceJoystick();
void initializePinKeypad();
char scanPinKeypadRaw();
void servicePinKeypad();
void handleNativeKeypadKey(char key);
void showPinKeypadBuffer(const String& status = "Enter 6 digits");

void latchEmergency(const String& reason);
bool clearEmergency(const String& source);

bool moveToPoseSmooth(
  const int target[NUM_SERVOS],
  const String& action
);

bool executeHome();
bool runJointSelfTest();
bool executePinSequence(const String& pin);
bool pressKey(
  uint8_t digit,
  uint8_t sequenceIndex,
  uint8_t sequenceLength
);

void handleCommand(String command);
bool setControlMode(ControlMode newMode);
void cycleControlMode();
void setSpeedMode(SpeedMode newSpeed);
void cycleSpeedMode();

// ------------------------------------------------------------
// Utility names and speed configuration
// ------------------------------------------------------------
String modeName() {
  return controlMode == ControlMode::MANUAL
    ? "MANUAL"
    : "AUTO";
}

String speedName() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      return "PRECISION";
    case SpeedMode::FAST:
      return "FAST";
    default:
      return "NORMAL";
  }
}

String shortSpeedName() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      return "P";
    case SpeedMode::FAST:
      return "F";
    default:
      return "N";
  }
}

int joystickStepDegrees() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      return 1;
    case SpeedMode::FAST:
      return 4;
    default:
      return 2;
  }
}

uint16_t joystickRepeatMs() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      return 130;
    case SpeedMode::FAST:
      return 55;
    default:
      return 85;
  }
}

uint16_t motionStepDelayMs() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      return 14;
    case SpeedMode::FAST:
      return 4;
    default:
      return 8;
  }
}

String runtimeStateName() {
  if (emergencyLatched) {
    return "E-STOP";
  }

  if (autonomousActive) {
    return "AUTO RUN";
  }

  if (motionBusy) {
    return "MOVING";
  }

  if (manualJogActive) {
    return "JOGGING";
  }

  return "READY";
}

// ------------------------------------------------------------
// 74HC595 LED output handling
// ------------------------------------------------------------
void commitIndicatorOutputs() {
  uint8_t value = keyLedMask & 0x3F;

  const bool ready =
    !emergencyLatched &&
    !motionBusy &&
    !autonomousActive &&
    !manualJogActive;

  if (ready) {
    value |= static_cast<uint8_t>(1U << READY_LED_BIT);
  }

  if (emergencyLatched) {
    value |= static_cast<uint8_t>(1U << STOP_LED_BIT);
  }

  digitalWrite(SHIFT_LATCH_PIN, LOW);
  shiftOut(
    SHIFT_DATA_PIN,
    SHIFT_CLOCK_PIN,
    MSBFIRST,
    value
  );
  digitalWrite(SHIFT_LATCH_PIN, HIGH);
}

void clearKeyLeds() {
  keyLedMask = 0;
  commitIndicatorOutputs();
}

void setKeyLed(uint8_t digit, bool on) {
  if (digit < 1 || digit > 6) {
    return;
  }

  const uint8_t bitIndex = KEY_LED_BITS[digit - 1];

  if (on) {
    keyLedMask |= static_cast<uint8_t>(1U << bitIndex);
  } else {
    keyLedMask &= static_cast<uint8_t>(~(1U << bitIndex));
  }

  commitIndicatorOutputs();
}

void showAllKeyLeds(bool on) {
  keyLedMask = on ? 0x3F : 0;
  commitIndicatorOutputs();
}

// ------------------------------------------------------------
// Display and structured serial events
// ------------------------------------------------------------
void emitEvent(
  const String& type,
  const String& payload
) {
  Serial.print("EVENT {\"type\":\"");
  Serial.print(type);
  Serial.print("\"");

  if (payload.length() > 0) {
    Serial.print(",");
    Serial.print(payload);
  }

  Serial.println("}");
}

void updateDisplay(
  const String& action,
  const String& detail1,
  const String& detail2
) {
  if (!displayAvailable) {
    return;
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("IUT ROBOT ARM");

  display.setCursor(0, 10);
  display.print("MODE:");
  display.print(modeName().substring(0, 1));
  display.print(" SPD:");
  display.print(shortSpeedName());
  display.print(" WIFI:");
  display.println(wifiConnected ? "ON" : "OFF");

  display.setCursor(0, 20);
  display.print("STATE:");
  display.println(runtimeStateName());

  display.setCursor(0, 32);
  display.println(action.substring(0, 21));

  display.setCursor(0, 42);
  display.println(detail1.substring(0, 21));

  display.setCursor(0, 52);
  display.println(detail2.substring(0, 21));

  display.display();
}

// ------------------------------------------------------------
// Wi-Fi
// ------------------------------------------------------------
void connectWiFi() {
  updateDisplay("Connecting WiFi", "Wokwi-GUEST");

  Serial.print("Connecting to Wokwi-GUEST");

  WiFi.mode(WIFI_STA);
  WiFi.begin("Wokwi-GUEST", "", 6);

  const unsigned long startedAt = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startedAt < WIFI_TIMEOUT_MS
  ) {
    Serial.print(".");
    delay(200);
  }

  wifiConnected = WiFi.status() == WL_CONNECTED;
  Serial.println();

  if (wifiConnected) {
    const String ip = WiFi.localIP().toString();

    Serial.print("WiFi connected. IP: ");
    Serial.println(ip);

    emitEvent(
      "wifi",
      String("\"status\":\"connected\",\"ip\":\"") +
      ip +
      "\""
    );
  } else {
    Serial.println(
      "WiFi timeout. Local circuit controls remain available."
    );

    emitEvent(
      "wifi",
      "\"status\":\"offline\""
    );
  }
}

// ------------------------------------------------------------
// Safety and stop logic
// ------------------------------------------------------------
void latchEmergency(const String& reason) {
  if (emergencyLatched) {
    return;
  }

  emergencyLatched = true;
  motionBusy = false;
  autonomousActive = false;
  manualJogActive = false;
  lastJoystickDirection = "IDLE";

  clearKeyLeds();
  commitIndicatorOutputs();

  updateDisplay(
    "EMERGENCY STOP",
    "Motion disabled",
    "Release + RESUME"
  );

  Serial.println(
    "!!! EMERGENCY STOP LATCHED: " + reason
  );

  emitEvent(
    "emergency_stop",
    String("\"reason\":\"") +
    reason +
    "\""
  );
}

bool clearEmergency(const String& source) {
  if (digitalRead(ESTOP_BUTTON_PIN) == LOW) {
    Serial.println(
      "ERROR: Release the E-STOP button before RESUME."
    );

    updateDisplay(
      "Resume blocked",
      "Release E-STOP",
      "Then press RESUME"
    );

    return false;
  }

  emergencyLatched = false;
  manualJogActive = false;
  lastJoystickDirection = "IDLE";

  commitIndicatorOutputs();

  updateDisplay(
    "System resumed",
    source,
    "Ready"
  );

  Serial.println(
    "Emergency stop cleared. Motion is enabled."
  );

  emitEvent(
    "resume",
    String("\"source\":\"") +
    source +
    "\",\"status\":\"ready\""
  );

  return true;
}

bool delayWithSafety(uint32_t durationMs) {
  const unsigned long startedAt = millis();

  while (millis() - startedAt < durationMs) {
    serviceSafety(true);

    if (emergencyLatched) {
      return false;
    }

    delay(4);
  }

  return true;
}

// ------------------------------------------------------------
// Serial command reading
// ------------------------------------------------------------
void processCompletedSerialLine(
  String line,
  bool duringMotion
) {
  line.trim();

  if (line.length() == 0) {
    return;
  }

  String upper = line;
  upper.toUpperCase();

  if (
    upper == "STOP" ||
    upper == "ESTOP" ||
    upper == "E-STOP"
  ) {
    latchEmergency("SERIAL_COMMAND");
    return;
  }

  if (duringMotion) {
    Serial.println(
      "BUSY: Command rejected during movement. STOP remains active."
    );

    emitEvent(
      "command_rejected",
      String("\"reason\":\"busy\",\"command\":\"") +
      line +
      "\""
    );

    return;
  }

  if (!pendingCommandAvailable) {
    pendingCommand = line;
    pendingCommandAvailable = true;
  } else {
    Serial.println(
      "BUSY: One serial command is already waiting."
    );
  }
}

void serviceSerial(bool duringMotion) {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());

    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        processCompletedSerialLine(
          serialBuffer,
          duringMotion
        );
        serialBuffer = "";
      }
    } else if (serialBuffer.length() < 160) {
      serialBuffer += c;
    } else {
      serialBuffer = "";
      Serial.println(
        "ERROR: Serial command exceeded 160 characters."
      );
    }
  }
}

void serviceSafety(bool duringMotion) {
  if (digitalRead(ESTOP_BUTTON_PIN) == LOW) {
    latchEmergency("PHYSICAL_BUTTON");
  }

  serviceSerial(duringMotion);
}

// ------------------------------------------------------------
// Joint validation and movement
// ------------------------------------------------------------
int clampAngle(uint8_t index, int angle) {
  return constrain(
    angle,
    JOINT_MIN[index],
    JOINT_MAX[index]
  );
}

bool validatePose(
  const int pose[NUM_SERVOS]
) {
  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    if (
      pose[i] < JOINT_MIN[i] ||
      pose[i] > JOINT_MAX[i]
    ) {
      Serial.printf(
        "ERROR: %s target %d outside range [%d,%d]\n",
        JOINT_NAMES[i],
        pose[i],
        JOINT_MIN[i],
        JOINT_MAX[i]
      );

      return false;
    }
  }

  return true;
}

double minimumJerk(double t) {
  return (
    10.0 * t * t * t -
    15.0 * t * t * t * t +
    6.0 * t * t * t * t * t
  );
}

bool moveToPoseSmooth(
  const int target[NUM_SERVOS],
  const String& action
) {
  if (emergencyLatched) {
    Serial.println(
      "ERROR: Motion blocked because E-STOP is latched."
    );
    return false;
  }

  if (!validatePose(target)) {
    updateDisplay(
      "Unsafe target",
      "Joint limit error",
      "Command rejected"
    );

    emitEvent(
      "motion_rejected",
      "\"reason\":\"joint_limit\""
    );

    return false;
  }

  int startAngles[NUM_SERVOS];
  int maximumDelta = 0;

  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    startAngles[i] = currentAngles[i];

    maximumDelta = max(
      maximumDelta,
      abs(target[i] - startAngles[i])
    );
  }

  if (maximumDelta == 0) {
    updateDisplay(
      action,
      "Already at target",
      "No movement needed"
    );
    return true;
  }

  motionBusy = true;
  manualJogActive = false;
  commitIndicatorOutputs();

  emitEvent(
    "motion_started",
    String("\"action\":\"") +
    action +
    "\",\"source\":\"system\""
  );

  for (int step = 1; step <= maximumDelta; step++) {
    serviceSafety(true);

    if (emergencyLatched) {
      motionBusy = false;
      commitIndicatorOutputs();

      emitEvent(
        "motion_aborted",
        "\"reason\":\"emergency_stop\""
      );

      return false;
    }

    const double t =
      static_cast<double>(step) /
      static_cast<double>(maximumDelta);

    const double blend = minimumJerk(t);

    for (
      uint8_t joint = 0;
      joint < NUM_SERVOS;
      joint++
    ) {
      const double value =
        static_cast<double>(startAngles[joint]) +
        static_cast<double>(
          target[joint] - startAngles[joint]
        ) * blend;

      const int safeAngle = clampAngle(
        joint,
        static_cast<int>(round(value))
      );

      servos[joint].write(safeAngle);
      currentAngles[joint] = safeAngle;
    }

    if (
      step == 1 ||
      step == maximumDelta ||
      step % 12 == 0
    ) {
      updateDisplay(
        action,
        "Step " +
        String(step) +
        "/" +
        String(maximumDelta),
        "J1:" +
        String(currentAngles[0]) +
        " J2:" +
        String(currentAngles[1])
      );
    }

    if (!delayWithSafety(motionStepDelayMs())) {
      motionBusy = false;
      commitIndicatorOutputs();
      return false;
    }
  }

  motionBusy = false;
  commitIndicatorOutputs();

  updateDisplay(
    action,
    "Completed",
    "System ready"
  );

  emitEvent(
    "motion_completed",
    String("\"action\":\"") +
    action +
    "\""
  );

  return true;
}

bool moveSingleJoint(
  uint8_t jointIndex,
  int targetAngle
) {
  if (jointIndex >= NUM_SERVOS) {
    Serial.println(
      "ERROR: Joint number must be from 1 to 6."
    );
    return false;
  }

  if (
    targetAngle < JOINT_MIN[jointIndex] ||
    targetAngle > JOINT_MAX[jointIndex]
  ) {
    Serial.printf(
      "ERROR: %s accepts %d to %d degrees.\n",
      JOINT_NAMES[jointIndex],
      JOINT_MIN[jointIndex],
      JOINT_MAX[jointIndex]
    );
    return false;
  }

  int target[NUM_SERVOS];
  memcpy(
    target,
    currentAngles,
    sizeof(target)
  );

  target[jointIndex] = targetAngle;

  return moveToPoseSmooth(
    target,
    "Joint " +
    String(jointIndex + 1) +
    " -> " +
    String(targetAngle)
  );
}

bool executeHome() {
  if (emergencyLatched) {
    Serial.println(
      "ERROR: HOME blocked because E-STOP is latched."
    );

    updateDisplay(
      "HOME blocked",
      "Clear E-STOP first",
      "Press RESUME"
    );

    return false;
  }

  const bool success = moveToPoseSmooth(
    HOME_POSE,
    "Returning home"
  );

  if (success) {
    Serial.println("HOME: Completed.");

    emitEvent(
      "home",
      "\"status\":\"completed\""
    );
  }

  return success;
}

// ------------------------------------------------------------
// Four-button joystick
// ------------------------------------------------------------
String joystickDirectionName(
  int horizontal,
  int vertical
) {
  String direction;

  if (vertical > 0) {
    direction = "UP";
  } else if (vertical < 0) {
    direction = "DOWN";
  }

  if (horizontal < 0) {
    if (direction.length() > 0) {
      direction += "+";
    }
    direction += "LEFT";
  } else if (horizontal > 0) {
    if (direction.length() > 0) {
      direction += "+";
    }
    direction += "RIGHT";
  }

  return direction.length() > 0
    ? direction
    : "IDLE";
}

bool applyJoystickStep(
  int horizontal,
  int vertical
) {
  if (controlMode != ControlMode::MANUAL) {
    updateDisplay(
      "Joystick blocked",
      "Switch to MANUAL",
      "Press MODE"
    );
    return false;
  }

  if (
    emergencyLatched ||
    motionBusy ||
    autonomousActive
  ) {
    return false;
  }

  if (horizontal == 0 && vertical == 0) {
    return false;
  }

  const int step = joystickStepDegrees();

  int target[NUM_SERVOS];
  memcpy(
    target,
    currentAngles,
    sizeof(target)
  );

  // LEFT / RIGHT: rotate the base.
  target[0] += horizontal * step;

  // UP / DOWN: coordinated shoulder, elbow, and wrist
  // movement. The browser digital twin will later replace
  // this representative mapping with true Cartesian IK.
  target[1] += vertical * step;
  target[2] -= vertical * step;
  target[4] += vertical * max(1, step / 2);

  bool changed = false;

  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    const int safe = clampAngle(i, target[i]);

    if (safe != currentAngles[i]) {
      changed = true;
    }

    target[i] = safe;
  }

  if (!changed) {
    updateDisplay(
      "Joystick limit",
      joystickDirectionName(
        horizontal,
        vertical
      ),
      "Safe limit reached"
    );

    emitEvent(
      "joystick_rejected",
      "\"reason\":\"joint_limit\""
    );

    return false;
  }

  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    servos[i].write(target[i]);
    currentAngles[i] = target[i];
  }

  lastJoystickDirection = joystickDirectionName(
    horizontal,
    vertical
  );

  updateDisplay(
    "JOYSTICK:" + lastJoystickDirection,
    "J1:" +
    String(currentAngles[0]) +
    " J2:" +
    String(currentAngles[1]),
    "J3:" +
    String(currentAngles[2]) +
    " J5:" +
    String(currentAngles[4])
  );

  emitEvent(
    "joystick_move",
    String("\"direction\":\"") +
    lastJoystickDirection +
    "\",\"speed\":\"" +
    speedName() +
    "\",\"angles\":[" +
    String(currentAngles[0]) + "," +
    String(currentAngles[1]) + "," +
    String(currentAngles[2]) + "," +
    String(currentAngles[3]) + "," +
    String(currentAngles[4]) + "," +
    String(currentAngles[5]) + "]"
  );

  return true;
}

void serviceJoystick() {
  if (
    controlMode != ControlMode::MANUAL ||
    emergencyLatched ||
    motionBusy ||
    autonomousActive
  ) {
    if (manualJogActive) {
      manualJogActive = false;
      lastJoystickDirection = "IDLE";
      commitIndicatorOutputs();
    }
    return;
  }

  const bool upPressed =
    digitalRead(JOY_UP_PIN) == LOW;

  const bool downPressed =
    digitalRead(JOY_DOWN_PIN) == LOW;

  const bool leftPressed =
    digitalRead(JOY_LEFT_PIN) == LOW;

  const bool rightPressed =
    digitalRead(JOY_RIGHT_PIN) == LOW;

  const int vertical =
    (upPressed ? 1 : 0) -
    (downPressed ? 1 : 0);

  const int horizontal =
    (rightPressed ? 1 : 0) -
    (leftPressed ? 1 : 0);

  if (horizontal == 0 && vertical == 0) {
    if (manualJogActive) {
      manualJogActive = false;
      lastJoystickDirection = "IDLE";
      commitIndicatorOutputs();

      updateDisplay(
        "Joystick released",
        "Manual mode",
        "System ready"
      );
    }
    return;
  }

  if (!manualJogActive) {
    manualJogActive = true;
    commitIndicatorOutputs();
  }

  if (
    millis() - lastJoystickStepMs <
    joystickRepeatMs()
  ) {
    return;
  }

  lastJoystickStepMs = millis();
  applyJoystickStep(horizontal, vertical);
}

// ------------------------------------------------------------
// Native Wokwi 4x4 manual PIN keypad
// ------------------------------------------------------------
void showPinKeypadBuffer(const String& status) {
  String visible = keypadPinBuffer;

  while (visible.length() < REQUIRED_PIN_LENGTH) {
    visible += "_";
  }

  updateDisplay(
    "PIN KEYPAD",
    "PIN: " + visible,
    status
  );
}

void clearPinKeypadBuffer(const String& reason) {
  keypadPinBuffer = "";

  showPinKeypadBuffer(reason);

  Serial.println(
    "KEYPAD: Buffer cleared (" + reason + ")"
  );

  emitEvent(
    "keypad_cleared",
    String("\"reason\":\"") + reason + "\""
  );
}

void executeEnteredPin() {
  if (controlMode != ControlMode::AUTO) {
    updateDisplay(
      "PIN blocked",
      "Switch to AUTO",
      "Press MODE"
    );

    Serial.println(
      "KEYPAD: ENTER rejected - system is in MANUAL mode."
    );

    emitEvent(
      "keypad_rejected",
      "\"reason\":\"manual_mode\""
    );

    return;
  }

  if (emergencyLatched) {
    updateDisplay(
      "PIN blocked",
      "E-STOP active",
      "Use RESUME"
    );

    emitEvent(
      "keypad_rejected",
      "\"reason\":\"emergency_stop\""
    );

    return;
  }

  if (motionBusy || autonomousActive || manualJogActive) {
    updateDisplay(
      "PIN blocked",
      "Motion is active",
      "Wait for READY"
    );

    emitEvent(
      "keypad_rejected",
      "\"reason\":\"busy\""
    );

    return;
  }

  if (keypadPinBuffer.length() != REQUIRED_PIN_LENGTH) {
    showPinKeypadBuffer(
      "Need exactly 6 digits"
    );

    Serial.printf(
      "KEYPAD: ENTER rejected - current PIN length is %u.\n",
      keypadPinBuffer.length()
    );

    emitEvent(
      "keypad_rejected",
      String("\"reason\":\"invalid_length\",\"length\":") +
      String(keypadPinBuffer.length())
    );

    return;
  }

  const String pinToExecute = keypadPinBuffer;
  keypadPinBuffer = "";

  updateDisplay(
    "PIN accepted",
    pinToExecute,
    "Starting movement"
  );

  Serial.println(
    "KEYPAD: Submitted PIN " + pinToExecute
  );

  emitEvent(
    "keypad_pin_submitted",
    String("\"pin\":\"") + pinToExecute + "\""
  );

  executePinSequence(pinToExecute);

  showPinKeypadBuffer(
    "Enter next PIN"
  );
}

void appendPinDigit(char digit) {
  if (controlMode != ControlMode::AUTO) {
    updateDisplay(
      "Keypad blocked",
      "Switch to AUTO",
      "Digit ignored"
    );

    Serial.printf(
      "KEYPAD: Digit %c rejected - MANUAL mode.\n",
      digit
    );

    emitEvent(
      "keypad_rejected",
      "\"reason\":\"manual_mode\""
    );

    return;
  }

  if (emergencyLatched || motionBusy || autonomousActive) {
    updateDisplay(
      "Keypad blocked",
      runtimeStateName(),
      "Digit ignored"
    );

    emitEvent(
      "keypad_rejected",
      "\"reason\":\"not_ready\""
    );

    return;
  }

  if (keypadPinBuffer.length() >= REQUIRED_PIN_LENGTH) {
    showPinKeypadBuffer(
      "PIN full: ENTER/CLEAR"
    );
    return;
  }

  keypadPinBuffer += digit;

  showPinKeypadBuffer(
    keypadPinBuffer.length() == REQUIRED_PIN_LENGTH
      ? "Press ENTER to start"
      : "Enter digit " +
        String(keypadPinBuffer.length() + 1) +
        "/6"
  );

  Serial.printf(
    "KEYPAD: Digit %c accepted, buffer=%s\n",
    digit,
    keypadPinBuffer.c_str()
  );

  emitEvent(
    "keypad_digit",
    String("\"digit\":\"") +
    digit +
    "\",\"length\":" +
    String(keypadPinBuffer.length())
  );
}

void handleNativeKeypadKey(char key) {
  Serial.printf(
    "KEYPAD_RAW: key=%c\n",
    key
  );

  if (key >= '1' && key <= '6') {
    appendPinDigit(key);
    return;
  }

  switch (key) {
    case 'A':
      cycleControlMode();
      break;

    case 'B':
      if (
        !motionBusy &&
        !autonomousActive &&
        !manualJogActive
      ) {
        executeHome();
      } else {
        Serial.println(
          "KEYPAD: HOME rejected - movement active."
        );
      }
      break;

    case 'C':
      clearPinKeypadBuffer("CLEAR pressed");
      break;

    case 'D':
      clearEmergency("KEYPAD");
      break;

    case '*':
      cycleSpeedMode();
      break;

    case '#':
      executeEnteredPin();
      break;

    case '0':
    case '7':
    case '8':
    case '9':
      updateDisplay(
        "Unsupported digit",
        String(key),
        "Allowed PIN: 1-6"
      );

      Serial.printf(
        "KEYPAD: Unsupported PIN digit %c ignored.\n",
        key
      );

      emitEvent(
        "keypad_rejected",
        String("\"reason\":\"unsupported_digit\",\"digit\":\"") +
        key +
        "\""
      );
      break;

    default:
      break;
  }
}

void initializePinKeypad() {
  // Input-only row pins use the external 10k pull-ups in diagram.json.
  for (uint8_t row = 0; row < KEYPAD_ROWS; row++) {
    pinMode(KEYPAD_ROW_PINS[row], INPUT);
  }

  // Keep every column inactive HIGH until it is scanned.
  for (uint8_t col = 0; col < KEYPAD_COLS; col++) {
    pinMode(KEYPAD_COL_PINS[col], OUTPUT);
    digitalWrite(KEYPAD_COL_PINS[col], HIGH);
  }
}

char scanPinKeypadRaw() {
  // Scan one column at a time. A pressed key connects its pulled-up
  // row to the active LOW column.
  for (uint8_t col = 0; col < KEYPAD_COLS; col++) {
    for (uint8_t resetCol = 0; resetCol < KEYPAD_COLS; resetCol++) {
      digitalWrite(KEYPAD_COL_PINS[resetCol], HIGH);
    }

    digitalWrite(KEYPAD_COL_PINS[col], LOW);
    delayMicroseconds(4);

    for (uint8_t row = 0; row < KEYPAD_ROWS; row++) {
      if (digitalRead(KEYPAD_ROW_PINS[row]) == LOW) {
        const char detectedKey = KEYPAD_KEYS[row][col];
        digitalWrite(KEYPAD_COL_PINS[col], HIGH);
        return detectedKey;
      }
    }

    digitalWrite(KEYPAD_COL_PINS[col], HIGH);
  }

  return KEYPAD_NO_KEY;
}

void servicePinKeypad() {
  const char rawKey = scanPinKeypadRaw();

  if (rawKey != keypadLastRawKey) {
    keypadLastRawKey = rawKey;
    keypadLastChangeMs = millis();
    return;
  }

  if (millis() - keypadLastChangeMs < KEYPAD_DEBOUNCE_MS) {
    return;
  }

  if (rawKey == keypadStableKey) {
    return;
  }

  keypadStableKey = rawKey;

  // Generate exactly one event per physical key press. A new event
  // cannot occur until the previous key has been released.
  if (keypadStableKey != KEYPAD_NO_KEY) {
    handleNativeKeypadKey(keypadStableKey);
  }
}

// ------------------------------------------------------------
// Mode and speed management
// ------------------------------------------------------------
bool setControlMode(ControlMode newMode) {
  if (
    motionBusy ||
    autonomousActive ||
    manualJogActive
  ) {
    Serial.println(
      "ERROR: Cannot change mode while movement is active."
    );

    updateDisplay(
      "Mode change blocked",
      "Stop movement first",
      modeName()
    );

    return false;
  }

  if (emergencyLatched) {
    Serial.println(
      "ERROR: Cannot change mode while E-STOP is latched."
    );
    return false;
  }

  controlMode = newMode;

  if (controlMode == ControlMode::MANUAL) {
    keypadPinBuffer = "";

    updateDisplay(
      "Mode changed",
      modeName(),
      "Joystick enabled"
    );
  } else {
    showPinKeypadBuffer(
      "Enter 6 digits"
    );
  }

  emitEvent(
    "mode_changed",
    String("\"mode\":\"") +
    modeName() +
    "\""
  );

  return true;
}

void cycleControlMode() {
  setControlMode(
    controlMode == ControlMode::MANUAL
      ? ControlMode::AUTO
      : ControlMode::MANUAL
  );
}

void setSpeedMode(SpeedMode newSpeed) {
  speedMode = newSpeed;

  updateDisplay(
    "Speed changed",
    speedName(),
    "Joystick + motion"
  );

  emitEvent(
    "speed_changed",
    String("\"speed\":\"") +
    speedName() +
    "\""
  );
}

void cycleSpeedMode() {
  switch (speedMode) {
    case SpeedMode::PRECISION:
      setSpeedMode(SpeedMode::NORMAL);
      break;
    case SpeedMode::NORMAL:
      setSpeedMode(SpeedMode::FAST);
      break;
    default:
      setSpeedMode(SpeedMode::PRECISION);
      break;
  }
}

// ------------------------------------------------------------
// PIN automation and key indicators
// ------------------------------------------------------------
bool validatePin(const String& pin) {
  if (pin.length() != 6) {
    Serial.println(
      "ERROR: PIN must contain exactly 6 digits."
    );
    return false;
  }

  for (uint8_t i = 0; i < pin.length(); i++) {
    if (pin[i] < '1' || pin[i] > '6') {
      Serial.println(
        "ERROR: Every PIN digit must be between 1 and 6."
      );
      return false;
    }
  }

  return true;
}

bool pressKey(
  uint8_t digit,
  uint8_t sequenceIndex,
  uint8_t sequenceLength
) {
  if (digit < 1 || digit > 6) {
    return false;
  }

  int approachPose[NUM_SERVOS];
  int contactPose[NUM_SERVOS];

  memcpy(
    approachPose,
    KEY_APPROACH_POSES[digit - 1],
    sizeof(approachPose)
  );

  memcpy(
    contactPose,
    approachPose,
    sizeof(contactPose)
  );

  // Coordinated contact motion: the touch is not produced by
  // only the optional stylus channel. Shoulder, elbow, wrist,
  // all participate in the simulated contact movement.
  contactPose[1] = clampAngle(
    1,
    contactPose[1] + 3
  );

  contactPose[2] = clampAngle(
    2,
    contactPose[2] - 5
  );

  contactPose[4] = clampAngle(
    4,
    contactPose[4] + 2
  );


  const String progress =
    "Digit " +
    String(sequenceIndex + 1) +
    "/" +
    String(sequenceLength);

  if (!moveToPoseSmooth(
        approachPose,
        "Approach key " + String(digit)
      )) {
    return false;
  }

  setKeyLed(digit, true);

  updateDisplay(
    "Press key " + String(digit),
    progress,
    "Indicator ON"
  );

  if (!moveToPoseSmooth(
        contactPose,
        "Press key " + String(digit)
      )) {
    setKeyLed(digit, false);
    return false;
  }

  if (!delayWithSafety(PRESS_HOLD_MS)) {
    setKeyLed(digit, false);
    return false;
  }

  if (!moveToPoseSmooth(
        approachPose,
        "Retract key " + String(digit)
      )) {
    setKeyLed(digit, false);
    return false;
  }

  setKeyLed(digit, false);

  Serial.printf(
    "PIN_PROGRESS: position=%u/%u digit=%u status=pressed\n",
    sequenceIndex + 1,
    sequenceLength,
    digit
  );

  emitEvent(
    "pin_progress",
    "\"index\":" +
    String(sequenceIndex + 1) +
    ",\"total\":" +
    String(sequenceLength) +
    ",\"digit\":" +
    String(digit) +
    ",\"status\":\"pressed\""
  );

  return true;
}

bool executePinSequence(const String& pin) {
  if (controlMode != ControlMode::AUTO) {
    Serial.println(
      "ERROR: PIN execution requires AUTO mode."
    );

    updateDisplay(
      "PIN blocked",
      "Switch to AUTO",
      "Press MODE"
    );

    emitEvent(
      "pin_rejected",
      "\"reason\":\"manual_mode\""
    );

    return false;
  }

  if (!validatePin(pin)) {
    updateDisplay(
      "Invalid PIN",
      "Use 6 digits",
      "Allowed keys: 1-6"
    );

    emitEvent(
      "pin_rejected",
      "\"reason\":\"invalid_format\""
    );

    return false;
  }

  if (emergencyLatched) {
    Serial.println(
      "ERROR: PIN execution blocked by E-STOP."
    );
    return false;
  }

  if (motionBusy || autonomousActive) {
    Serial.println(
      "ERROR: Another movement is already active."
    );
    return false;
  }

  autonomousActive = true;
  manualJogActive = false;
  clearKeyLeds();
  commitIndicatorOutputs();

  Serial.println(
    "Starting autonomous PIN sequence: " + pin
  );

  emitEvent(
    "pin_started",
    String("\"pin\":\"") +
    pin +
    "\""
  );

  for (uint8_t i = 0; i < 6; i++) {
    serviceSafety(true);

    if (emergencyLatched) {
      autonomousActive = false;
      clearKeyLeds();
      commitIndicatorOutputs();

      emitEvent(
        "pin_aborted",
        "\"reason\":\"emergency_stop\",\"index\":" +
        String(i + 1)
      );

      return false;
    }

    const uint8_t digit =
      static_cast<uint8_t>(pin[i] - '0');

    if (!pressKey(digit, i, 6)) {
      autonomousActive = false;
      clearKeyLeds();
      commitIndicatorOutputs();

      Serial.println(
        "PIN sequence failed at position " +
        String(i + 1)
      );

      emitEvent(
        "pin_failed",
        "\"index\":" +
        String(i + 1)
      );

      return false;
    }
  }

  if (!executeHome()) {
    autonomousActive = false;
    clearKeyLeds();
    commitIndicatorOutputs();
    return false;
  }

  showAllKeyLeds(true);

  if (!delayWithSafety(700)) {
    showAllKeyLeds(false);
    autonomousActive = false;
    commitIndicatorOutputs();
    return false;
  }

  showAllKeyLeds(false);
  autonomousActive = false;
  commitIndicatorOutputs();

  updateDisplay(
    "PIN complete",
    pin,
    "6/6 keys passed"
  );

  Serial.println(
    "PIN sequence completed successfully."
  );

  emitEvent(
    "pin_completed",
    String("\"pin\":\"") +
    pin +
    "\",\"pressed\":6"
  );

  return true;
}

// ------------------------------------------------------------
// Self-tests
// ------------------------------------------------------------
bool runPanelLightTest() {
  if (emergencyLatched) {
    return false;
  }

  Serial.println(
    "Starting six-key indicator test."
  );

  clearKeyLeds();

  for (uint8_t digit = 1; digit <= 6; digit++) {
    setKeyLed(digit, true);

    updateDisplay(
      "Panel LED test",
      "Key " + String(digit),
      "Indicator ON"
    );

    if (!delayWithSafety(180)) {
      clearKeyLeds();
      return false;
    }

    setKeyLed(digit, false);
  }

  Serial.println("PANEL_TEST: PASSED.");

  emitEvent(
    "panel_test",
    "\"status\":\"passed\""
  );

  return true;
}

bool runJointSelfTest() {
  if (emergencyLatched) {
    Serial.println(
      "ERROR: TEST blocked by E-STOP."
    );
    return false;
  }

  Serial.println(
    "Starting six-channel joint self-test."
  );

  emitEvent(
    "self_test_started",
    "\"channels\":6"
  );

  if (!executeHome()) {
    return false;
  }

  for (uint8_t joint = 0; joint < NUM_SERVOS; joint++) {
    const int positiveTarget = min(
      HOME_POSE[joint] + 20,
      JOINT_MAX[joint]
    );

    const int negativeTarget = max(
      HOME_POSE[joint] - 20,
      JOINT_MIN[joint]
    );

    if (!moveSingleJoint(
          joint,
          positiveTarget
        )) {
      return false;
    }

    if (!moveSingleJoint(
          joint,
          negativeTarget
        )) {
      return false;
    }

    if (!moveSingleJoint(
          joint,
          HOME_POSE[joint]
        )) {
      return false;
    }
  }

  if (!runPanelLightTest()) {
    return false;
  }

  updateDisplay(
    "Self-test passed",
    "6 servo channels",
    "6 panel indicators"
  );

  Serial.println("SELF_TEST: PASSED.");

  emitEvent(
    "self_test_completed",
    "\"status\":\"passed\""
  );

  return true;
}

// ------------------------------------------------------------
// Status and help
// ------------------------------------------------------------
void printStatus() {
  Serial.println();
  Serial.println(
    "========== ROBOT ARM STATUS =========="
  );

  Serial.println(
    "Mode: " + modeName()
  );

  Serial.println(
    "State: " + runtimeStateName()
  );

  Serial.println(
    "Speed: " + speedName()
  );

  Serial.println(
    "WiFi: " +
    String(
      wifiConnected
        ? "CONNECTED"
        : "OFFLINE"
    )
  );

  Serial.println(
    "Joystick: " + lastJoystickDirection
  );

  Serial.println(
    "Official arm channels: 6"
  );

  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    Serial.printf(
      "J%u %-20s angle=%3d range=[%3d,%3d]\n",
      i + 1,
      JOINT_NAMES[i],
      currentAngles[i],
      JOINT_MIN[i],
      JOINT_MAX[i]
    );
  }

  Serial.println(
    "======================================"
  );
  Serial.println();
}

void printHelp() {
  Serial.println();
  Serial.println(
    "=============== COMMANDS ==============="
  );
  Serial.println("HELP");
  Serial.println("STATUS");
  Serial.println("HOME");
  Serial.println("TEST");
  Serial.println("PANELTEST");
  Serial.println("PIN 123456  (serial debug input)");
  Serial.println("KEYPAD: press 1-6, CLEAR, then ENTER");
  Serial.println("KEY 5");
  Serial.println("JOINT <1-6> <angle>");
  Serial.println(
    "POSE a1 a2 a3 a4 a5 a6"
  );
  Serial.println("UP / DOWN / LEFT / RIGHT");
  Serial.println(
    "MODE MANUAL / MODE AUTO / MODE"
  );
  Serial.println(
    "SPEED PRECISION / NORMAL / FAST / SPEED"
  );
  Serial.println("STOP");
  Serial.println("RESUME");
  Serial.println("WIFI");
  Serial.println(
    "========================================"
  );
  Serial.println(
    "Keypad labels: MODE, HOME, CLEAR,"
  );
  Serial.println(
    "SPEED, ENTER, RESUME"
  );
  Serial.println(
    "Digits 1-6 build the six-digit PIN"
  );
  Serial.println();
}

// ------------------------------------------------------------
// Serial command execution
// ------------------------------------------------------------
void handlePoseCommand(
  const String& command
) {
  int pose[NUM_SERVOS];

  const int parsed = sscanf(
    command.c_str(),
    "%*s %d %d %d %d %d %d",
    &pose[0],
    &pose[1],
    &pose[2],
    &pose[3],
    &pose[4],
    &pose[5]
  );

  if (parsed != NUM_SERVOS) {
    Serial.println(
      "ERROR: Use POSE a1 a2 a3 a4 a5 a6"
    );
    return;
  }

  moveToPoseSmooth(
    pose,
    "Custom pose"
  );
}

void handleCommand(String command) {
  command.trim();

  if (command.length() == 0) {
    return;
  }

  String upper = command;
  upper.toUpperCase();

  Serial.println(
    "COMMAND: " + command
  );

  emitEvent(
    "command_received",
    String("\"command\":\"") +
    command +
    "\""
  );

  if (upper == "HELP") {
    printHelp();
  } else if (upper == "STATUS") {
    printStatus();
  } else if (upper == "HOME") {
    executeHome();
  } else if (upper == "TEST") {
    runJointSelfTest();
  } else if (upper == "PANELTEST") {
    runPanelLightTest();
  } else if (
    upper == "STOP" ||
    upper == "ESTOP" ||
    upper == "E-STOP"
  ) {
    latchEmergency("SERIAL_COMMAND");
  } else if (upper == "RESUME") {
    clearEmergency("SERIAL");
  } else if (upper == "UP") {
    applyJoystickStep(0, 1);
  } else if (upper == "DOWN") {
    applyJoystickStep(0, -1);
  } else if (upper == "LEFT") {
    applyJoystickStep(-1, 0);
  } else if (upper == "RIGHT") {
    applyJoystickStep(1, 0);
  } else if (upper == "MODE") {
    cycleControlMode();
  } else if (upper == "MODE MANUAL") {
    setControlMode(ControlMode::MANUAL);
  } else if (upper == "MODE AUTO") {
    setControlMode(ControlMode::AUTO);
  } else if (upper == "SPEED") {
    cycleSpeedMode();
  } else if (upper == "SPEED PRECISION") {
    setSpeedMode(SpeedMode::PRECISION);
  } else if (upper == "SPEED NORMAL") {
    setSpeedMode(SpeedMode::NORMAL);
  } else if (upper == "SPEED FAST") {
    setSpeedMode(SpeedMode::FAST);
  } else if (upper == "WIFI") {
    Serial.println(
      "WiFi status: " +
      String(
        wifiConnected
          ? "CONNECTED"
          : "OFFLINE"
      )
    );

    if (wifiConnected) {
      Serial.println(
        "IP address: " +
        WiFi.localIP().toString()
      );
    }
  } else if (upper.startsWith("PIN ")) {
    String pin = command.substring(4);
    pin.trim();
    executePinSequence(pin);
  } else if (upper.startsWith("KEY ")) {
    int digit = 0;

    if (
      sscanf(
        upper.c_str(),
        "KEY %d",
        &digit
      ) != 1 ||
      digit < 1 ||
      digit > 6
    ) {
      Serial.println(
        "ERROR: Use KEY <1-6>"
      );
      return;
    }

    if (controlMode != ControlMode::AUTO) {
      Serial.println(
        "ERROR: KEY command requires AUTO mode."
      );
      return;
    }

    autonomousActive = true;
    commitIndicatorOutputs();

    const bool success = pressKey(
      static_cast<uint8_t>(digit),
      0,
      1
    );

    autonomousActive = false;
    commitIndicatorOutputs();

    if (success) {
      executeHome();
    }
  } else if (upper.startsWith("JOINT ")) {
    int jointNumber = 0;
    int targetAngle = 0;

    if (
      sscanf(
        upper.c_str(),
        "JOINT %d %d",
        &jointNumber,
        &targetAngle
      ) != 2
    ) {
      Serial.println(
        "ERROR: Use JOINT <1-6> <angle>"
      );
      return;
    }

    if (
      jointNumber < 1 ||
      jointNumber > NUM_SERVOS
    ) {
      Serial.println(
        "ERROR: Joint number must be 1-6."
      );
      return;
    }

    moveSingleJoint(
      static_cast<uint8_t>(jointNumber - 1),
      targetAngle
    );
  } else if (upper.startsWith("POSE ")) {
    handlePoseCommand(upper);
  } else {
    Serial.println(
      "ERROR: Unknown command. Type HELP."
    );

    updateDisplay(
      "Unknown command",
      command,
      "Type HELP"
    );

    emitEvent(
      "command_rejected",
      "\"reason\":\"unknown_command\""
    );
  }
}

// ------------------------------------------------------------
// Setup and loop
// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);

  pinMode(ESTOP_BUTTON_PIN, INPUT_PULLUP);

  pinMode(JOY_UP_PIN, INPUT_PULLUP);
  pinMode(JOY_DOWN_PIN, INPUT_PULLUP);
  pinMode(JOY_LEFT_PIN, INPUT_PULLUP);
  pinMode(JOY_RIGHT_PIN, INPUT_PULLUP);

  initializePinKeypad();

  pinMode(SHIFT_DATA_PIN, OUTPUT);
  pinMode(SHIFT_CLOCK_PIN, OUTPUT);
  pinMode(SHIFT_LATCH_PIN, OUTPUT);

  digitalWrite(SHIFT_DATA_PIN, LOW);
  digitalWrite(SHIFT_CLOCK_PIN, LOW);
  digitalWrite(SHIFT_LATCH_PIN, LOW);

  clearKeyLeds();
  commitIndicatorOutputs();

  Wire.begin(
    OLED_SDA_PIN,
    OLED_SCL_PIN
  );

  displayAvailable = display.begin(
    SSD1306_SWITCHCAPVCC,
    0x3C
  );

  if (!displayAvailable) {
    Serial.println(
      "WARNING: OLED initialization failed."
    );
  }

  updateDisplay(
    "Initializing",
    "Servo channels",
    "Please wait"
  );

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    servos[i].setPeriodHertz(50);

    servos[i].attach(
      SERVO_PINS[i],
      SERVO_MIN_US,
      SERVO_MAX_US
    );

    servos[i].write(
      currentAngles[i]
    );
  }

  delay(500);
  connectWiFi();

  commitIndicatorOutputs();

  updateDisplay(
    "System ready",
    "Press MODE",
    "Then enter 6 digits"
  );

  Serial.println(
    "Complete robot-arm circuit simulation is ready."
  );

  Serial.println(
    "Keypad matrix ready: custom scanner, external pull-ups, "
    "rows=GPIO34/35/36/39, columns=GPIO0/15/27/33"
  );

  printHelp();
  printStatus();
}

void loop() {
  serviceSafety(false);

  if (
    pendingCommandAvailable &&
    !motionBusy &&
    !autonomousActive
  ) {
    const String command = pendingCommand;

    pendingCommand = "";
    pendingCommandAvailable = false;

    handleCommand(command);
  }

  servicePinKeypad();
  serviceJoystick();

  delay(4);
}