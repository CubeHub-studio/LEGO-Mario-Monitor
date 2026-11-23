# LEGO Mario Monitor

A free, browser-based LEGO Mario Bluetooth monitor using the LEGO Wireless Protocol (LWP).

## What it does

- Connects directly to a compatible LEGO hub through Web Bluetooth.
- Listens for hub notifications and logs raw LWP packets.
- Discovers attached I/O ports from Hub Attached I/O messages (0x04).
- Requests port capabilities and mode metadata using Port Information (0x21) and Port Mode Information (0x22).
- Subscribes to an available input mode using Port Input Format Setup (0x41), then displays incoming Port Value messages (0x45 / 0x46) as raw data.
- Reads standard hub properties 0x01–0x0F, including battery percentage, firmware/hardware version, RSSI, and device information.
- Includes the Mario speaker-volume control. Its 0x12 property is a Mario-specific extension confirmed by project testing; it is **not** part of the published standard LWP Hub Property table.
- Supports the documented BUSY indication actions (Hub Actions 0x05 and 0x06).
- Includes a clearly labelled firmware-update-screen simulation only; it does not update firmware.

The dashboard deliberately does not assign fixed sensor meanings to port numbers. The hub reports which I/O devices are attached and which input modes they support. The monitor chooses mode 0 when available, otherwise the first reported input mode, and lets scripts request other modes.

## Protocol boundaries

- The standard Hub Property references are 0x01 through 0x0F. The monitor does not send 0x12 as a standard hub property; the speaker-volume feature is kept separate as a tested Mario-specific extension.
- The published Hub Action list documents 0x01–0x06 and does **not** define a general restart action. No undocumented restart packet is sent.
- The published protocol does not document a command for writing arbitrary custom text to Mario's belly display. The `mario.displaytext()` API therefore reports that it is unavailable rather than sending an invented packet.
- LEGO Mario does not expose a camera image stream through this interface. The sensor panel is a raw-data monitor, not a camera feed.
- The firmware screen is a local animation only. Use LEGO's official app for actual firmware maintenance.

## Run it

1. Open the deployed page over HTTPS (or serve it from localhost).
2. Use a Web Bluetooth-compatible browser, such as Chrome on Android or Chrome/Edge on desktop.
3. Turn on LEGO Mario and press **Connect Mario**.
4. Select the hub in the browser's Bluetooth chooser and approve the connection.
5. Wait for attached-I/O events and move the figure or interact with compatible tiles to generate sensor values.

Close the official LEGO app before connecting if it already holds the Bluetooth connection.

No account, API key, backend, or paid service is required. Bluetooth access stays in the browser session.

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

Site: https://cubehub-studio.github.io/LEGO-Mario-Monitor/

## Official protocol reference

LEGO Wireless Protocol 3.0.00 documentation:
https://lego.github.io/lego-ble-wireless-protocol-docs/

Relevant message types:
- Hub Properties: 0x01
- Hub Actions: 0x02
- Hub Attached I/O: 0x04
- Port Information Request: 0x21
- Port Mode Information Request: 0x22
- Port Input Format Setup (single mode): 0x41
- Port Value (single / combined): 0x45 / 0x46
