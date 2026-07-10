#include <ESP32Servo.h>

Servo servos[6];
const int pins[6] = {18, 19, 21, 22, 23, 5};
const int estopPin = 27;
const int ledPin = 2;
bool eStopped = false;

void safeDetach() {
  for (int i = 0; i < 6; i++) servos[i].detach();
  digitalWrite(ledPin, LOW);
}

void resetServos() {
  for (int i = 0; i < 6; i++) {
    servos[i].attach(pins[i], 500, 2500);
    servos[i].write(90);
  }
  digitalWrite(ledPin, HIGH);
  Serial.println("Simulation reset: six servo outputs at neutral.");
}

void setup() {
  Serial.begin(115200);
  pinMode(estopPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.println("Wokwi simulation-only direct PWM PoC. Production uses PCA9685.");
  resetServos();
}

void loop() {
  if (digitalRead(estopPin) == LOW && !eStopped) {
    eStopped = true;
    safeDetach();
    Serial.println("E-stop latched: outputs detached.");
  }
  if (eStopped) {
    delay(50);
    return;
  }
  for (int i = 0; i < 6; i++) {
    servos[i].write(70 + i * 8);
    delay(100);
  }
  for (int i = 0; i < 6; i++) {
    servos[i].write(90);
    delay(100);
  }
}
