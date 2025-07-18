import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import axios from "axios";
import dayjs from "dayjs";
import "./App.css";
import { HubConnectionBuilder } from "@microsoft/signalr";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


export default function App() {
  const chartRef = useRef(null);
  const [chart, setChart] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [zoomRange, setZoomRange] = useState({ start: 95, end: 100 });
  const [visibleSensors, setVisibleSensors] = useState([]);
  const [startDate, setStartDate] = useState(
    dayjs().subtract(1, "hour").toDate()

  );

  console.log("sensorData", sensorData)
  const [endDate, setEndDate] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
      const connection = new HubConnectionBuilder()
        .withUrl("http://localhost:5294/temperatureHub")
        .withAutomaticReconnect()
        .build();

      connection.on("temperatureData", (data) => {
         setSensorData((prevData) => {
        const newData = { ...prevData };
        const { sensorName, temperature, time } = data;
        if (!newData[sensorName]) newData[sensorName] = [];
        const parsedTime = new Date(time);
        newData[sensorName].push({
          time: parsedTime,
          temperature: parseFloat(temperature),
        });
        newData[sensorName] = newData[sensorName].filter(
          (point) => dayjs().diff(dayjs(point.time), "day") < 3
        );
        return newData;
      });
      });

      connection
        .start()
        .then(() => setIsConnected(true))
        .catch((err) => console.error("Connection failed:", err));

      return () => connection.stop();
    
  }, []);


  useEffect(() => {
    if (!chartRef.current) return;
    const myChart = echarts.init(chartRef.current, "dark");
    setChart(myChart);
    myChart.on("datazoom", () => {
      const opts = myChart.getOption();
      const start = opts.dataZoom[0].start;
      const end = opts.dataZoom[0].end;
      setZoomRange({ start, end });
    });
    return () => myChart.dispose();
  }, []);

  const fetchHistoricalData = () => {
    const url = "http://localhost:5294/api/history";
    axios.get(url).then((res) => {
      const formatted = {};
      for (const sensor in res.data) {
        formatted[sensor] = res.data[sensor]
          .map((entry) => ({
            time: new Date(entry.time),
            temperature: parseFloat(entry.temperature),
          }))
          .filter((point) => point.time >= startDate && point.time <= endDate);
      }
      setSensorData(formatted);
      setVisibleSensors(Object.keys(formatted));
    });
  };

  useEffect(() => {
    fetchHistoricalData();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!chart) return;

    const minTime = startDate ? startDate.getTime() : Math.min(...allTimes);
    const maxTime = endDate ? endDate.getTime() : Math.max(...allTimes);
    const allSeries = visibleSensors.map((sensorName, index) => {
      const colorPalette = [
        "#91CC75",
        "#73C0DE",
        "#FAC858",
        "#5470C6",
        "#EE6666",
      ];
      return {
        name: sensorName,
        type: "line",
        smooth: false,
        showSymbol: false,
        sampling: "lttb",
        data: (sensorData[sensorName] || []).map((point) => [
          point.time,
          point.temperature,
        ]),
        lineStyle: { width: 1.5, opacity: 0.9 },
        itemStyle: { color: colorPalette[index % colorPalette.length] },
      };
    });
    chart.setOption(
      {
        backgroundColor: "#1f1f1f",
        title: {
          text: "Temperature Data by Sensor",
          left: "center",
          textStyle: { color: "#fff" },
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          formatter: (params) => {
            return `<div>
            ${params
              .map(
                (
                  p
                ) => `<span style='display:inline-block;margin-right:6px;border-radius:10px;width:10px;height:10px;background-color:${p.color}'></span>
            <strong>${p.seriesName}</strong>: ${p.data[1]}&deg;C<br/>`
              )
              .join("")}
            <em>${dayjs(params[0].data[0]).format("HH:mm:ss DD/MM/YYYY")}</em>
          </div>`;
          },
        },
        legend: {
          data: visibleSensors,
          top: 30,
          textStyle: { color: "#ccc" },
        },
        xAxis: {
          type: "time",
          name: "Time",
         
          axisLabel: {
            formatter: (value) => dayjs(value).format("HH:mm DD/MM/YYYY"),
            color: "#ccc",
          },
          axisLine: { lineStyle: { color: "#666" } },
        },
        yAxis: {
          type: "value",
          name: "Temperature (°C)",
          min: -10,
          max: 10,
          axisLabel: { formatter: "{value}°C", color: "#ccc" },
          axisLine: { lineStyle: { color: "#666" } },
        },
        dataZoom: [
          { type: "slider", start: zoomRange.start, end: zoomRange.end },
          { type: "inside", start: zoomRange.start, end: zoomRange.end },
        ],
        series: allSeries,
      },
      true
    );
  }, [sensorData, chart, zoomRange, visibleSensors]);

  const handleToggleSensor = (sensor) => {
    setVisibleSensors((prev) =>
      prev.includes(sensor)
        ? prev.filter((s) => s !== sensor)
        : [...prev, sensor]
    );
  };

  const resetView = () => {
    setZoomRange({ start: 95, end: 100 });
    setStartDate(dayjs().subtract(1, "hour").toDate());
    setEndDate(new Date());
    fetchHistoricalData();
  };

  return (
    <div className="app-container">
      <h1 className="title">Live Temperature Monitoring</h1>

      <div className="cards">
        <div className="card">
          <p className="label">WebSocket Status</p>
          <p className={`value ${isConnected ? "green" : "red"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </p>
        </div>
        <div className="card">
          <p className="label">Active Sensors</p>
          <p className="value">{Object.keys(sensorData).length}</p>
        </div>
        <div className="card">
          <p className="label">Reset View</p>
          <button className="reset-btn" onClick={resetView}>
            Reset
          </button>
        </div>
      </div>

      <div className="sensor-checkboxes">
        {Object.keys(sensorData).map((sensor) => (
          <label
            key={sensor}
            className="checkbox-label"
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginRight: "1rem",
            }}
          >
            <input
              type="checkbox"
              checked={visibleSensors.includes(sensor)}
              onChange={() => handleToggleSensor(sensor)}
              style={{ marginRight: "0.5rem" }}
            />
            <span>{sensor}</span>
          </label>
        ))}
      </div>

      <div className="date-pickers">
        <div>
          <label>Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            showTimeSelect
            dateFormat="Pp"
            className="datepicker"
          />
        </div>
        <div>
          <label>End Date</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            showTimeSelect
            dateFormat="Pp"
            className="datepicker"
          />
        </div>
      </div>

      <div
        ref={chartRef}
        className="chart"
        style={{ width: "100%", height: "60vh" }}
      />
    </div>
  );
}
