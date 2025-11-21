// ✅ Configura tus credenciales de Supabase
const SUPABASE_URL = "https://TU-PROJECT-ID.supabase.co";        // <-- cambia esto
const SUPABASE_ANON_KEY = "TU_ANON_PUBLIC_KEY";                  // <-- cambia esto

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sensorSelect = document.getElementById("sensorSelect");
const tablaSensoresBody = document.querySelector("#tablaSensores tbody");
const tablaTelemetryBody = document.querySelector("#tablaTelemetry tbody");
const tablaAlertsBody = document.querySelector("#tablaAlerts tbody");
const statusMessage = document.getElementById("statusMessage");

const btnCargarDatos = document.getElementById("btnCargarDatos");
const btnSimularLectura = document.getElementById("btnSimularLectura");

let telemetryChart = null;

// Al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
  await cargarSensores();
  await cargarAlertsRecientes();

  // Si hay sensores, carga el primero por defecto
  if (sensorSelect.value) {
    await cargarTelemetry(sensorSelect.value);
  }
});

// Listeners
btnCargarDatos.addEventListener("click", async () => {
  if (!sensorSelect.value) return;
  await cargarTelemetry(sensorSelect.value);
});

btnSimularLectura.addEventListener("click", async () => {
  if (!sensorSelect.value) {
    alert("Selecciona un sensor primero.");
    return;
  }
  await insertarLecturaSimulada(sensorSelect.value);
  await cargarTelemetry(sensorSelect.value);
  await cargarAlertsRecientes();
});

// =========================
// Funciones principales
// =========================

async function cargarSensores() {
  statusMessage.textContent = "Cargando sensores...";
  try {
    const { data, error } = await supabase
      .from("sensors")
      .select(`
        id,
        metric_type,
        unit,
        hardware_id,
        machines ( name )
      `)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Limpiar UI
    sensorSelect.innerHTML = "";
    tablaSensoresBody.innerHTML = "";

    data.forEach((sensor) => {
      // Combo
      const opt = document.createElement("option");
      opt.value = sensor.id;
      opt.textContent = `${sensor.metric_type.toUpperCase()} – ${sensor.hardware_id || sensor.id}`;
      sensorSelect.appendChild(opt);

      // Tabla
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sensor.hardware_id || sensor.id}</td>
        <td>${sensor.metric_type}</td>
        <td>${sensor.unit || ""}</td>
        <td>${sensor.machines ? sensor.machines.name : ""}</td>
      `;
      tablaSensoresBody.appendChild(tr);
    });

    statusMessage.textContent = data.length
      ? `Se cargaron ${data.length} sensores.`
      : "No hay sensores registrados.";
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Error al cargar sensores.";
  }
}

async function cargarTelemetry(sensorId) {
  statusMessage.textContent = "Cargando telemetría...";

  try {
    const { data, error } = await supabase
      .from("telemetry")
      .select("id, timestamp, value, metadata")
      .eq("sensor_id", sensorId)
      .order("timestamp", { ascending: false })
      .limit(50); // últimas 50 lecturas

    if (error) throw error;

    // Tabla
    tablaTelemetryBody.innerHTML = "";
    data.forEach((row) => {
      const tr = document.createElement("tr");
      const fecha = new Date(row.timestamp).toLocaleString();
      const meta = row.metadata ? JSON.stringify(row.metadata) : "";

      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${row.value.toFixed(2)}</td>
        <td><code>${meta}</code></td>
      `;
      tablaTelemetryBody.appendChild(tr);
    });

    // Gráfico
    const labels = data
      .map((r) => new Date(r.timestamp))
      .reverse();
    const values = data
      .map((r) => r.value)
      .reverse();

    renderChart(labels, values);

    statusMessage.textContent = data.length
      ? `Se cargaron ${data.length} registros de telemetría.`
      : "No hay telemetría para este sensor.";
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Error al cargar telemetría.";
  }
}

async function cargarAlertsRecientes() {
  try {
    const { data, error } = await supabase
      .from("alerts")
      .select("created_at, sensor_id, value, threshold, severity, status")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    tablaAlertsBody.innerHTML = "";
    data.forEach((alert) => {
      const tr = document.createElement("tr");
      const fecha = new Date(alert.created_at).toLocaleString();

      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${alert.sensor_id}</td>
        <td>${alert.value != null ? alert.value.toFixed(2) : ""}</td>
        <td>${alert.threshold != null ? alert.threshold.toFixed(2) : ""}</td>
        <td>${alert.severity || ""}</td>
        <td>${alert.status || ""}</td>
      `;
      tablaAlertsBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function insertarLecturaSimulada(sensorId) {
  statusMessage.textContent = "Insertando lectura simulada...";
  const valor = 60 + Math.random() * 30; // 60–90

  try {
    const { error } = await supabase.from("telemetry").insert([
      {
        sensor_id: sensorId,
        value: valor,
        metadata: { source: "frontend-demo", unit: "C" }
      }
    ]);

    if (error) throw error;

    statusMessage.textContent = `Lectura simulada insertada (valor: ${valor.toFixed(
      2
    )}).`;
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Error al insertar lectura simulada.";
  }
}

// =========================
// Gráfico con Chart.js
// =========================

function renderChart(labels, values) {
  const ctx = document.getElementById("telemetryChart");

  if (telemetryChart) {
    telemetryChart.destroy();
  }

  telemetryChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels.map((d) =>
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      ),
      datasets: [
        {
          label: "Valor del sensor",
          data: values,
          fill: false,
          borderColor: "rgba(32, 201, 151, 1)",
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#ecf5ff"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#c7d4f2" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          ticks: { color: "#c7d4f2" },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });
}
