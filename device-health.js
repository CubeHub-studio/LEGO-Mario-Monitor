/* LEGO Mario Monitor · Device Health report helpers
 * Based on LEGO Wireless Protocol 3.0.00. This file only summarizes
 * observations supplied by the main page; it does not send BLE commands.
 */
(function (root) {
  "use strict";
  const PROPERTY_NAMES = {
    1: "Advertising name", 2: "Button state", 3: "Firmware version",
    4: "Hardware version", 5: "RSSI", 6: "Battery level",
    7: "Battery type", 8: "Manufacturer", 9: "Radio firmware",
    10: "LWP protocol version", 11: "System type", 12: "Hardware network ID",
    13: "Primary MAC", 14: "Secondary MAC", 15: "Hardware network family"
  };
  const ALERT_NAMES = {
    1: "Low voltage", 2: "High current",
    3: "Low signal strength", 4: "Over-power condition"
  };
  const ERROR_NAMES = {
    1: "ACK", 2: "MACK", 3: "Buffer overflow", 4: "Timeout",
    5: "Command not recognized", 6: "Invalid command/parameters",
    7: "Overcurrent", 8: "Internal hub error"
  };
  const MODE_NAMES = ["NAME", "RAW", "PCT", "SI", "SYMBOL", "MAPPING", "INTERNAL", "MOTOR BIAS", "CAPABILITIES", "VALUE FORMAT"];
  const IO_TYPE_NAMES = {
    1:"Motor",2:"System train motor",5:"Button",8:"LED light",
    20:"Voltage sensor",21:"Current sensor",22:"Piezo tone",23:"RGB light",
    34:"External tilt sensor",35:"Motion sensor",37:"Vision sensor",
    38:"External motor with tacho",39:"Internal motor with tacho",40:"Internal tilt"
  };
  const has = (value) => value !== undefined && value !== null && value !== "";
  const row = (name, status, detail, group) => ({ name, status, detail: String(detail || ""), group: group || "General" });

  function buildReport(s) {
    const rows = [];
    const props = s.properties || {};
    const alerts = s.alerts || {};
    const ports = s.ports || [];
    const add = (name, status, detail, group) => rows.push(row(name, status, detail, group));

    add("Bluetooth / GATT connection", s.connected ? "PASS" : "UNAVAILABLE",
      s.connected ? "LEGO Hub service and characteristic are connected." : "No active connection.", "Connection");
    add("Notification stream", s.connected ? (s.notificationCount > 0 ? "PASS" : "WAITING") : "UNAVAILABLE",
      s.connected ? (s.notificationCount + " notification packet(s) received during this session.") : "Connect to collect notifications.", "Connection");

    for (const [id, name] of Object.entries(PROPERTY_NAMES)) {
      const value = props[id];
      add(name, has(value) ? "PASS" : "NO RESPONSE",
        has(value) ? value : "No reply received; this may be unsupported by this hub.", "Hub properties");
    }

    const battery = props[6];
    if (has(battery)) {
      const n = Number(String(battery).match(/-?\d+(?:\.\d+)?/)?.[0]);
      const status = Number.isFinite(n) ? (n <= 15 ? "WARNING" : "PASS") : "INFO";
      add("Battery level assessment", status,
        Number.isFinite(n) ? (n + "% reported. This is a simple low-charge indicator, not a battery-capacity test.") : String(battery),
        "Power");
    } else add("Battery level assessment", "UNAVAILABLE", "Battery percentage was not reported.", "Power");

    for (const [id, name] of Object.entries(ALERT_NAMES)) {
      const value = alerts[id];
      add(name + " alert state", value === true ? "WARNING" : value === false ? "PASS" : "NO RESPONSE",
        value === true ? "Hub reported this alert as active." : value === false ? "Hub reported status OK." : "No alert-state response received.",
        "Hub alerts");
    }

    add("Attached I/O ports", ports.length ? "PASS" : "NO PORTS REPORTED",
      ports.length ? ports.length + " port(s): " + ports.map(p => "0x" + Number(p.id).toString(16).padStart(2,"0").toUpperCase()).join(", ") : "No attached-port messages received. This can be normal for a hub without external ports.",
      "Ports");

    for (const p of ports) {
      const c = Number(p.capabilities || 0);
      const caps = [
        (c & 1) ? "output" : null, (c & 2) ? "input" : null,
        (c & 4) ? "logical combinable" : null, (c & 8) ? "logical synchronizable" : null
      ].filter(Boolean);
      if (has(p.ioType)) {
        const typeName = IO_TYPE_NAMES[p.ioType] || "Unlisted I/O device";
        add("Port " + p.id + " device type", "INFO",
          typeName + " · type ID 0x" + Number(p.ioType).toString(16).padStart(4,"0").toUpperCase(),
          "Ports");
      }
      if (p.hardwareRevision || p.softwareRevision) {
        add("Port " + p.id + " device revisions", "INFO",
          "Hardware: " + (p.hardwareRevision || "not supplied") + " · Software: " + (p.softwareRevision || "not supplied"),
          "Ports");
      }
      if (p.virtualPorts) {
        add("Port " + p.id + " virtual-port mapping", "INFO",
          "Formed from ports " + p.virtualPorts.join(" and ") + ".", "Ports");
      }
      add("Port " + p.id + " capabilities", has(p.capabilities) ? "PASS" : "WAITING",
        has(p.capabilities) ? (caps.join(", ") || "No capability bits set") + "; " + (p.modeCount || 0) + " total mode(s)." : "Capability response not received.",
        "Ports");
      const modes = p.modes || {};
      const modeIds = Object.keys(modes);
      const modeTotal = modeIds.length;
      const metadataCount = modeIds.reduce((n, id) => n + Object.keys(modes[id] || {}).length, 0);
      add("Port " + p.id + " mode metadata", modeTotal ? "PASS" : "WAITING",
        modeTotal + " mode(s) described; " + metadataCount + " metadata field(s) received.",
        "Sensor metadata");
      add("Port " + p.id + " input values", p.valueCount > 0 ? "PASS" : "NO VALUE",
        (p.valueCount || 0) + " value packet(s) observed. No values may simply mean the port has no active input mode.",
        "Sensor data");
      if (p.combinations !== undefined) {
        add("Port " + p.id + " combined-mode support", "PASS",
          (p.combinations.length || 0) + " supported combination(s) reported.", "Sensor metadata");
      } else if (c & 4) {
        add("Port " + p.id + " combined-mode support", "WAITING",
          "Port advertises logical-combinable capability; combination list has not replied.", "Sensor metadata");
      }
    }

    const modes = s.modeAcks || 0;
    add("Input-format acknowledgements", modes ? "PASS" : "NO RESPONSE",
      modes + " single/combined input-format acknowledgement(s) received.", "Sensor configuration");
    add("Combined sensor value packets", s.combinedValues ? "PASS" : "NO DATA",
      (s.combinedValues || 0) + " combined-mode value packet(s) observed.", "Sensor data");
    const protocolFaults = (s.errors || []).filter(e => e.code >= 3);
    const acknowledgements = (s.errors || []).filter(e => e.code === 1 || e.code === 2);
    add("Hub generic errors", protocolFaults.length ? "WARNING" : "PASS",
      protocolFaults.length ? protocolFaults.map(e => (ERROR_NAMES[e.code] || ("Error 0x" + e.code.toString(16))) + " on command 0x" + e.command.toString(16)).join("; ") : "No protocol fault codes received.",
      "Protocol");
    add("Protocol acknowledgements", acknowledgements.length ? "INFO" : "NO ACK",
      acknowledgements.length ? acknowledgements.length + " ACK/MACK response(s) received; these are informational, not faults." : "No ACK/MACK packets observed.",
      "Protocol");
    add("Hub-originated action events", (s.hubEvents || []).length ? "INFO" : "NO EVENT",
      (s.hubEvents || []).map(e => e.label).join(", ") || "No switch-off/disconnect/boot-mode event received.",
      "Events");
    add("Attached-I/O event history", (s.ioEvents || []).length ? "INFO" : "NO EVENT",
      (s.ioEvents || []).length ? s.ioEvents.length + " attach/detach/virtual-port event(s) observed." : "No attached-I/O event observed in this session.",
      "Events");
    add("Speaker volume extension", has(props[18]) ? "PASS" : "NOT REPORTED",
      has(props[18]) ? "Mario-specific volume property replied: " + props[18] : "The extension is not part of standard LWP; no response was recorded.",
      "Mario-specific");
    add("LCD framebuffer / screen stream", "NOT AVAILABLE",
      "No display-frame or framebuffer channel is defined by standard LWP 3.0.00.", "Capabilities");

    const counts = rows.reduce((o, r) => { o[r.status] = (o[r.status] || 0) + 1; return o; }, {});
    return {
      schema: "lego-mario-device-health/1",
      generatedAt: new Date().toISOString(),
      summary: {
        checks: rows.length,
        pass: counts.PASS || 0,
        warning: counts.WARNING || 0,
        waiting: counts.WAITING || 0,
        unavailable: (counts.UNAVAILABLE || 0) + (counts["NO RESPONSE"] || 0) + (counts["NOT AVAILABLE"] || 0) + (counts["NO DATA"] || 0) + (counts["NO VALUE"] || 0) + (counts["NO PORTS REPORTED"] || 0) + (counts["NOT REPORTED"] || 0) + (counts["NO ACK"] || 0) + (counts["NO EVENT"] || 0)
      },
      rows
    };
  }

  root.DeviceHealthDiagnostics = Object.freeze({
    buildReport,
    propertyNames: Object.freeze(PROPERTY_NAMES),
    alertNames: Object.freeze(ALERT_NAMES),
    errorNames: Object.freeze(ERROR_NAMES),
    modeNames: Object.freeze(MODE_NAMES),
    ioTypeNames: Object.freeze(IO_TYPE_NAMES)
  });
})(typeof window !== "undefined" ? window : globalThis);
