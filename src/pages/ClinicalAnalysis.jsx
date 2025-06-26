import React from 'react';
import { useRef, useState } from 'react';
import dicomParser from 'dicom-parser';

const ClinicalAnalysis = () => {
  const canvasRef = useRef(null);
  const [selectedRegion, setSelectedRegion] = useState('Spinal');
  const [pinPoints, setPinPoints] = useState([]);
  const [showLabels, setShowLabels] = useState(REGISTRATION_OPTIONS['Spinal'].map(() => true));
  const [dicomImageData, setDicomImageData] = useState(null);
  const [lineDrawn, setLineDrawn] = useState(false);

  const REGISTRATION_NAMES = REGISTRATION_OPTIONS[selectedRegion];

  const handleRegionChange = (e) => {
    const region = e.target.value;
    setSelectedRegion(region);
    setPinPoints([]);
    setShowLabels(REGISTRATION_OPTIONS[region].map(() => true));
  };

  const handleToggleLabel = (idx) => {
    const updated = [...showLabels];
    updated[idx] = !updated[idx];
    setShowLabels(updated);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const arrayBuffer = event.target.result;
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        const width = dataSet.uint16('x00280011');
        const height = dataSet.uint16('x00280010');
        const pixelDataElement = dataSet.elements.x7fe00010;

        const pixelData = new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < pixelData.length; i++) {
          const value = pixelData[i];
          imageData.data[i * 4 + 0] = value;
          imageData.data[i * 4 + 1] = value;
          imageData.data[i * 4 + 2] = value;
          imageData.data[i * 4 + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        setDicomImageData(imageData);
        setPinPoints([]);
        setShowLabels(REGISTRATION_OPTIONS[selectedRegion].map(() => true));
      } catch (err) {
        alert('DICOM parsing failed: ' + err.message);
        console.error(err);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const name = REGISTRATION_NAMES[pinPoints.length];
    const newPoints = [...pinPoints, { x, y, name }];
    setPinPoints(newPoints);

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#16a34a';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1;
    ctx.strokeText(name, x + 12, y - 12);
    ctx.fillStyle = '#22c55e';
    ctx.globalAlpha = 0.85;
    ctx.fillText(name, x + 12, y - 12);
    ctx.globalAlpha = 1;
  };

  const drawLine = () => {
    if (pinPoints.length < 2) {
      alert('Please pin at least two points.');
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Clear canvas and redraw DICOM image if present
    if (dicomImageData) {
      ctx.putImageData(dicomImageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Draw the line in red
    ctx.beginPath();
    ctx.moveTo(pinPoints[0].x, pinPoints[0].y);
    for (let i = 1; i < pinPoints.length; i++) {
      ctx.lineTo(pinPoints[i].x, pinPoints[i].y);
    }
    ctx.strokeStyle = '#ef4444'; // Tailwind red-500
    ctx.lineWidth = 2;
    ctx.stroke();
    // Remove points and labels from state
    setPinPoints([]);
    setShowLabels(REGISTRATION_OPTIONS[selectedRegion].map(() => true));
    setLineDrawn(true);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'clinical-analysis.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  const handleReset = () => {
    setPinPoints([]);
    setShowLabels(REGISTRATION_OPTIONS[selectedRegion].map(() => true));
    setLineDrawn(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (dicomImageData) {
      ctx.putImageData(dicomImageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className='min-h-screen bg-green-50 w-full max-w-none p-4'>
      <h1 className='text-3xl font-extrabold text-center text-green-800 drop-shadow-sm mb-2'>Clinical Analysis</h1>
      <div className='grid grid-cols-12 gap-4'>
        <div className='col-start-1 col-end-3'>
          <div className='w-full flex flex-col items-start mb-2'>
            <label
              htmlFor='region-select'
              className='font-semibold text-green-700 mb-1'>
              Type
            </label>
            <select
              id='region-select'
              value={selectedRegion}
              onChange={handleRegionChange}
              className='border border-green-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 w-full bg-white text-green-800 font-medium shadow-sm transition'>
              <option value='Spinal'>Spinal</option>
              <option value='Neck'>Neck</option>
            </select>
          </div>
        </div>
        <div className='col-start-3 col-end-10'>
          <div className='flex flex-col items-center'>
            <input
              type='file'
              accept='.dcm'
              onChange={handleFileChange}
              className='file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 focus:file:ring-2 focus:file:ring-green-400 transition mb-2'
            />
            <div className='bg-white rounded-2xl shadow-lg p-4 flex flex-col items-center'>
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                onClick={handleCanvasClick}
                className='border-2 border-green-300 rounded-xl shadow-md cursor-crosshair mb-2'
              />
            </div>
          </div>
        </div>
        <div className='col-start-10 col-end-13'>
          <div className='bg-white rounded-2xl shadow-xl p-6 w-full  flex-shrink-0 border border-green-100'>
            <h2 className='text-xl font-bold mb-4 text-green-800 flex items-center gap-2'>Registration Points</h2>
            <ul className='max-h-96 overflow-y-auto space-y-2'>
              {REGISTRATION_NAMES.map((name, idx) => (
                <li
                  key={name}
                  className={`flex items-center px-2 py-1 rounded-lg transition ${idx < pinPoints.length ? 'bg-green-50' : ''}`}>
                  <input
                    type='checkbox'
                    checked={showLabels[idx]}
                    disabled={idx >= pinPoints.length}
                    onChange={() => handleToggleLabel(idx)}
                    className='mr-2 accent-green-600 cursor-pointer disabled:opacity-50'
                  />
                  <span className={`${idx < pinPoints.length ? 'text-green-700 font-semibold' : 'text-gray-400'}`}>{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className='flex gap-3 mt-4'>
            <button
              onClick={drawLine}
              className='px-5 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 focus:ring-2 focus:ring-green-400 shadow transition'>
              Draw
            </button>
            <button
              onClick={handleReset}
              className='px-5 py-2 bg-white text-green-700 border border-green-400 rounded-lg font-semibold hover:bg-green-50 focus:ring-2 focus:ring-green-400 shadow transition'>
              Reset
            </button>
            <button
              onClick={handleDownload}
              disabled={!lineDrawn}
              className={`px-5 py-2 rounded-lg font-semibold shadow transition border ${
                lineDrawn ? 'bg-red-600 text-white hover:bg-red-700 border-red-600' : 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalAnalysis;

const REGISTRATION_OPTIONS = {
  Spinal: [
    'L1 Spinous Process',
    'L2 Spinous Process',
    'L3 Spinous Process',
    'L4 Spinous Process',
    'Iliac Crest Left',
    'Iliac Crest Right',
    'SB Left',
    'SB Right',
    'S1 Spinous Process',
    'S2 Spinous Process',
  ],
  Neck: [
    'C1 Spinous Process',
    'C2 Spinous Process',
    'C3 Spinous Process',
    'C4 Spinous Process',
    'C5 Spinous Process',
    'C6 Spinous Process',
    'C7 Spinous Process',
    'Mandible',
    'Hyoid',
    'Thyroid Cartilage',
    'Cricoid Cartilage',
  ],
};
