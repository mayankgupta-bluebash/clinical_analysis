import React from 'react';
import { useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { jsPDF } from 'jspdf';
import dicomParser from 'dicom-parser';
import uploadIcon from '../assets/images/upload.svg';
import logo from '../assets/images/logo.svg';
import reset from '../assets/images/reset.svg';

const ChiroPlot = () => {
  const canvasRef = useRef(null);
  const [selectedRegion, setSelectedRegion] = useState('Spinal');
  const [pinPoints, setPinPoints] = useState([]);
  const [actualPoints, setActualPoints] = useState([]);
  const [showLabels, setShowLabels] = useState(REGISTRATION_OPTIONS['Spinal'].map(() => true));
  const [dicomImageData, setDicomImageData] = useState(null);
  const [lineDrawn, setLineDrawn] = useState(false);
  const [actualLineDrawn, setActualLineDrawn] = useState(false);
  const [drawingActual, setDrawingActual] = useState(false);

  const REGISTRATION_NAMES = REGISTRATION_OPTIONS[selectedRegion];

  const handleRegionChange = (e) => {
    const region = e.target.value;
    setSelectedRegion(region);
    setPinPoints([]);
    setActualPoints([]);
    setShowLabels(REGISTRATION_OPTIONS[region].map(() => true));
  };

  const handleToggleLabel = (idx) => {
    const updated = [...showLabels];
    updated[idx] = !updated[idx];
    setShowLabels(updated);
  };

  const handleFile = (file) => {
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
        setActualPoints([]);
        setShowLabels(REGISTRATION_OPTIONS[selectedRegion].map(() => true));
      } catch (err) {
        alert('DICOM parsing failed: ' + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/dicom': ['.dcm'] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        handleFile(acceptedFiles[0]);
      }
    },
  });

  const handleCanvasClick = (e) => {
    if (!dicomImageData) return;
    if (!drawingActual && pinPoints.length >= REGISTRATION_NAMES.length) return;
    if (drawingActual && actualPoints.length >= REGISTRATION_NAMES.length) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const name = REGISTRATION_NAMES[drawingActual ? actualPoints.length : pinPoints.length];
    if (!drawingActual) {
      const newPoints = [...pinPoints, { x, y, name }];
      setPinPoints(newPoints);
      drawDot(canvas, x, y, name, '#ef4444', '#b91c1c');
    } else {
      const newPoints = [...actualPoints, { x, y, name }];
      setActualPoints(newPoints);
      drawDot(canvas, x, y, name, '#2563eb', '#1d4ed8');
    }
  };

  function drawDot(canvas, x, y, name, fill, shadow, showLabel = true) {
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (showLabel) {
      ctx.font = 'bold 14px Arial';
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 1;
      ctx.strokeText(name, x + 12, y - 12);
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.85;
      ctx.fillText(name, x + 12, y - 12);
      ctx.globalAlpha = 1;
    }
  }

  const drawLine = () => {
    if (!drawingActual) {
      if (pinPoints.length < 2) {
        alert('Please pin at least two points.');
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (dicomImageData) {
        ctx.putImageData(dicomImageData, 0, 0);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.beginPath();
      ctx.moveTo(pinPoints[0].x, pinPoints[0].y);
      for (let i = 1; i < pinPoints.length; i++) {
        ctx.lineTo(pinPoints[i].x, pinPoints[i].y);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      pinPoints.forEach((pt) => drawDot(canvas, pt.x, pt.y, pt.name, '#ef4444', '#b91c1c', false));
      setLineDrawn(true);
      setDrawingActual(true);
    } else {
      if (actualPoints.length < 2) {
        alert('Please pin at least two points for the actual line.');
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (dicomImageData) {
        ctx.putImageData(dicomImageData, 0, 0);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.beginPath();
      ctx.moveTo(pinPoints[0].x, pinPoints[0].y);
      for (let i = 1; i < pinPoints.length; i++) {
        ctx.lineTo(pinPoints[i].x, pinPoints[i].y);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(actualPoints[0].x, actualPoints[0].y);
      for (let i = 1; i < actualPoints.length; i++) {
        ctx.lineTo(actualPoints[i].x, actualPoints[i].y);
      }
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();
      pinPoints.forEach((pt) => drawDot(canvas, pt.x, pt.y, pt.name, '#ef4444', '#b91c1c', false));
      actualPoints.forEach((pt) => drawDot(canvas, pt.x, pt.y, pt.name, '#2563eb', '#1d4ed8', false));
      setActualLineDrawn(true);
      setDrawingActual(false);
    }
  };

  const handleDownloadJPG = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'clinical-analysis.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  const handleDownloadPDF = () => {
    const canvas = canvasRef.current;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save('clinical-analysis.pdf');
  };

  const handleReset = () => {
    setPinPoints([]);
    setActualPoints([]);
    setShowLabels(REGISTRATION_OPTIONS[selectedRegion].map(() => true));
    setLineDrawn(false);
    setActualLineDrawn(false);
    setDrawingActual(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (dicomImageData) {
      ctx.putImageData(dicomImageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  const workflowStep = !dicomImageData ? 1 : !lineDrawn ? 2 : !actualLineDrawn ? 3 : 4;

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='bg-[#002E6C] text-white flex flex-col md:flex-row justify-between items-center px-4 md:px-10 py-4 md:py-0'>
        <div className='mb-2 md:mb-0'>
          <h1 className='text-xl md:text-2xl font-bold'>X-Ray Analysis Platform</h1>
          <p className='text-xs md:text-sm font-light'>Professional spinal alignment analysis tool</p>
        </div>
        <div className='flex items-center gap-2'>
          <img
            src={logo}
            alt='logo'
            className='h-8 md:h-10'
          />
        </div>
      </header>
      {/* Main Content */}
      <div className='flex flex-col lg:flex-row gap-6 md:gap-8 px-2 md:px-6 lg:px-10 py-4 md:py-8'>
        {/* Left Column: Workflow */}
        <div className='w-full lg:w-1/5 mb-6 lg:mb-0'>
          <div className='bg-white rounded-xl shadow p-4 md:p-6 mb-6'>
            <label
              htmlFor='region-select'
              className='block font-semibold mb-2'>
              Analysis Type
            </label>
            <select
              id='region-select'
              value={selectedRegion}
              onChange={handleRegionChange}
              className='w-full border border-gray-300 rounded px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm'>
              <option value='Spinal'>Spinal</option>
              <option value='Neck'>Neck</option>
            </select>
            <div className='mt-2'>
              {/* Workflow Stepper */}
              <div className='flex items-center mb-4'>
                <span className={`rounded-full w-7 h-7 flex items-center justify-center mr-3 text-white text-lg font-bold ${workflowStep > 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
                  {workflowStep > 1 ? '✓' : '1'}
                </span>
                <span className='text-gray-800 text-sm md:text-base'>Upload X-Ray</span>
              </div>
              <div className='flex items-center mb-4'>
                <span
                  className={`rounded-full w-7 h-7 flex items-center justify-center mr-3 text-white text-lg font-bold ${
                    workflowStep === 2 ? 'bg-blue-600' : workflowStep > 2 ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                  {workflowStep > 2 ? '✓' : '2'}
                </span>
                <span className='text-gray-800 text-sm md:text-base'>Draw Incorrect Line</span>
              </div>
              <div className='flex items-center'>
                <span
                  className={`rounded-full w-7 h-7 flex items-center justify-center mr-3 text-white text-lg font-bold ${
                    workflowStep === 3 ? 'bg-blue-600' : workflowStep > 3 ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                  {workflowStep > 3 ? '✓' : '3'}
                </span>
                <span className='text-gray-800 text-sm md:text-base'>Draw Correct Line</span>
              </div>
            </div>
          </div>
        </div>
        {/* Center Column: X-ray Image */}
        <div className='flex-1 w-full'>
          <div className='bg-white rounded-xl shadow p-4 md:p-6 flex flex-col items-center'>
            <div className='flex flex-col sm:flex-row justify-between w-full mb-2 gap-2'>
              <span className='font-semibold text-base md:text-lg'>X-Ray Image</span>
              <button
                onClick={handleReset}
                className='w-fit flex items-center gap-1 text-left rounded-lg px-4 py-1.5 text-sm text-[#898989] bg-white border border-[#AEAEAE]'>
                <span>Reset</span>
                <img
                  src={reset}
                  alt='reset icon'
                  className='h-4 w-4'
                />
              </button>
            </div>
            <div className='flex flex-col items-center w-full'>
              {!dicomImageData && (
                <div
                  {...getRootProps()}
                  className={`w-full mb-2 p-4 border-2 border-dashed rounded-lg h-[320px] md:h-[400px] lg:h-[520px] flex justify-center items-center transition cursor-pointer ${
                    isDragActive ? 'border-[#E5E7EB]' : 'border-[#E5E7EB] bg-white'
                  }`}>
                  <input {...getInputProps()} />
                  <div className='flex flex-col gap-2'>
                    <img
                      src={uploadIcon}
                      alt=''
                      className='w-8 md:w-10 mx-auto'
                    />
                    <p className='text-center text-[#4F4F4F] text-sm md:text-base font-semibold'>Upload X-Ray Image</p>
                    <p className='text-center font-medium text-[#898989] text-xs md:text-sm'>
                      {isDragActive ? 'Drop the DICOM file here...' : 'Drag & drop a DICOM (.dcm) file here, or click to select'}
                    </p>
                    <div className='flex mt-1'>
                      <button className='bg-white py-1 px-3 rounded-lg border border-[#AEAEAE] text-[#2B2B2B] text-xs mx-auto'>Browse File</button>
                    </div>
                  </div>
                </div>
              )}
              <div
                className={`bg-white rounded-2xl flex flex-col items-center ${dicomImageData ? 'opacity-100 p-2 md:p-4' : 'opacity-0 h-0'}`}
                style={{ width: '100%' }}>
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={520}
                  onClick={handleCanvasClick}
                  className='cursor-crosshair border border-5 border-[#BCCBF6] rounded-lg w-full max-w-[320px] md:max-w-[400px] lg:max-w-[520px] h-auto'
                />
              </div>
            </div>
            <div className='flex flex-col sm:flex-row gap-2 w-full justify-end mt-2'>
              <button
                onClick={handleDownloadJPG}
                disabled={!actualLineDrawn}
                className={`w-fit text-left rounded-lg px-4 py-2 text-sm text-[#898989] ${
                  !actualLineDrawn ? 'opacity-50 bg-[#EDEDED] cursor-not-allowed' : 'bg-white border border-[#AEAEAE]'
                }`}>
                Download as JPG
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={!actualLineDrawn}
                className={`w-fit text-left rounded-lg px-4 py-2 text-sm text-[#898989] ${
                  !actualLineDrawn ? 'opacity-50 bg-[#EDEDED] cursor-not-allowed' : 'bg-white border border-[#AEAEAE]'
                }`}>
                Download as PDF
              </button>
            </div>
          </div>
        </div>
        {/* Right Column: Registration Points and Line Drawing */}
        <div className='w-full lg:w-1/4 flex flex-col gap-6 mt-6 lg:mt-0'>
          <div className='bg-white rounded-xl shadow p-4 md:p-6'>
            <span className='font-semibold block mb-4 text-base md:text-lg'>Registration Points</span>
            <ul className='space-y-2'>
              {REGISTRATION_NAMES.map((name, idx) => (
                <li
                  key={name}
                  className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={(!drawingActual && idx < pinPoints.length) || (drawingActual && idx < actualPoints.length)}
                    disabled
                    className='mr-2 accent-blue-600 cursor-pointer disabled:opacity-50'
                  />
                  <span className={(!drawingActual && idx < pinPoints.length) || (drawingActual && idx < actualPoints.length) ? 'text-blue-700 font-semibold' : 'text-gray-400'}>
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className='bg-white rounded-xl shadow p-4 md:p-6'>
            <span className='block mb-2 text-base md:text-lg'>Line Drawing</span>
            <p className='text-gray-500 text-xs md:text-sm mb-4'>First, mark all registration points on the X-ray, then proceed to draw lines.</p>
            <button
              onClick={drawLine}
              disabled={drawingActual ? actualPoints.length < 2 : pinPoints.length < 2}
              className={`w-full px-4 py-2 rounded font-semibold transition text-white ${drawingActual ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} ${
                (drawingActual ? actualPoints.length < 2 : pinPoints.length < 2) ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
              {drawingActual ? 'Draw Correct Line' : 'Draw Incorrect Line'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChiroPlot;

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
