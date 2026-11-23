# LEGO Mario Monitor

A free, browser-based LEGO Mario Bluetooth sensor dashboard.

## What it shows

- Port 1: colour/barcode sensor packets (raw bytes)
- Port 0: movement sensor packets
- Port 2: pants/accessory sensor packets
- Port 3: events/debug packets
- Port 4: experimental device packets (IO type 0x55)
- A Bluetooth packet log

**Camera limitation:** LEGO Mario does not expose a camera image stream. The “Sensor view” panel visualizes the latest Port 1 sensor packet; it is not a camera feed or a view of the room. Unknown values are shown as raw bytes rather than guessed.

## Run it

1. Open the deployed page over HTTPS (or serve the files from localhost).
2. Use a Web Bluetooth-compatible browser, such as Chrome on Android or Chrome/Edge on desktop.
3. Turn on LEGO Mario and press **Connect Mario**.
4. Select the hub in the browser's Bluetooth chooser and approve the connection.
5. Move Mario over a compatible tile or move the figure to produce sensor updates.

No account, API key, backend, or paid service is required. Bluetooth access is local to the browser session.

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. After deployment, the site should be available at:

`https://cubehub-studio.github.io/LEGO-Mario-Monitor/`

## Protocol notes

The page uses the LEGO Wireless Protocol BLE service UUID `00001623-1212-EFDE-1623-785FEABCD123` and hub characteristic UUID `00001624-1212-EFDE-1623-785FEABCD123`. It listens for notifications and requests single-mode input notifications with message type `0x41`. Sensor values arrive as LWP message type `0x45` (single) or `0x46` (combined).

This first version requests mode 0 on ports 0–4. A port's single-mode subscription is one mode at a time; it does not request multiple modes on the same port simultaneously. The requested port/mode list follows the project's reverse-engineering notes and may need adjustment for different firmware or figure variants. Individual subscription failures are logged without stopping the other ports.

The page does not send display-writing, motor-control, or other output commands. It only configures sensor notification subscriptions and reads incoming data.
