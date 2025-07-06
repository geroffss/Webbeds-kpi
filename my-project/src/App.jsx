import { useState } from 'react'
import * as XLSX from 'xlsx'

function App() {
  const [data, setData] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [kpiResults, setKpiResults] = useState(null)
  
  // Manual input fields
  const [manualInputs, setManualInputs] = useState({
    agentError: '', // 1 or 0
    quality: '', // percentage
    f9Availability: '' // percentage
  })

  // Agent groups
  const agentGroups = {
    URGENT: [
      'Darius Pop',
      'Gerda Rausz', 
      'Sorin Tarnavean',
      'Pogacian Sara',
      'Geza Fangli',
      'Eszter Csiki',
      'Dragos Stoica',
      'Andrei Stefan',
      'Simon Botond',
      'Alexandra Crisan'
    ],
    MEDIUM: [
      'Simon Ors',
      'Petronela Adam',
      'Veronica Varga',
      'Simona Moldovan',
      'Sara Bosnjak',
      'Albu Florentina',
      'Botond Kovacs',
      'Robert Szasz',
      'Gabriel Klaus Sacalas',
      'Alicia Perez',
      'Benedek Kuna',
      'Vanni Giancotti'
    ]
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)
      setData(jsonData)
    }
    reader.readAsBinaryString(file)
  }

  const getUniqueAgents = () => {
    const allAgents = [...new Set(data.map(row => row.Agent).filter(Boolean))]
    if (selectedGroup) {
      return allAgents.filter(agent => agentGroups[selectedGroup].includes(agent))
    }
    return allAgents
  }

  const getAgentGroup = (agentName) => {
    if (agentGroups.URGENT.includes(agentName)) return 'URGENT'
    if (agentGroups.MEDIUM.includes(agentName)) return 'MEDIUM'
    return 'OTHER'
  }

  const parseExcelDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      // Handle different date formats
      if (typeof dateString === 'number') {
        // Excel serial date number
        return new Date((dateString - 25569) * 86400 * 1000);
      }
      
      if (typeof dateString === 'string') {
        // Handle formats like "6/27/25", "6/1/25", etc.
        const parts = dateString.split('/');
        if (parts.length === 3) {
          let month = parseInt(parts[0]) - 1; // JavaScript months are 0-based
          let day = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          
          // Handle 2-digit years (assume 2000s)
          if (year < 100) {
            year += 2000;
          }
          
          return new Date(year, month, day);
        }
        
        // Try standard JavaScript date parsing as fallback
        return new Date(dateString);
      }
      
      return null;
    } catch (error) {
      console.warn('Date parsing error:', error, 'for date:', dateString);
      return null;
    }
  };

  const filterDataByMonthAndAgent = () => {
    if (!selectedMonth || !selectedAgent) return []
    
    return data.filter(row => {
      // Check if the agent matches (either in Agent column or Assigned To column)
      const isAgentMatch = row.Agent === selectedAgent || row['Assigned To'] === selectedAgent
      
      if (!isAgentMatch) return false
      
      // Only check Resolution Date for month filtering
      if (row['Resolution Date']) {
        const resolutionDate = parseExcelDate(row['Resolution Date']);
        if (resolutionDate && !isNaN(resolutionDate.getTime())) {
          const rowMonth = `${resolutionDate.getFullYear()}-${String(resolutionDate.getMonth() + 1).padStart(2, '0')}`;
          return rowMonth === selectedMonth;
        }
      }
      
      return false
    })
  }

  // KPI Calculation Functions for MEDIUM group
  const calculateAgentErrorScore = (hasError) => {
    return hasError === '1' ? 1 : 5 // 1 for Yes (error), 5 for No (no error)
  }

  const calculateQualityScore = (qualityPercent) => {
    const quality = parseFloat(qualityPercent)
    if (quality > 91) return 5
    if (quality === 90) return 4
    if (quality >= 85) return 3
    if (quality >= 80) return 2
    return 1
  }

  const calculateRelocationScore = (relocationPercent) => {
    const relocation = parseFloat(relocationPercent)
    if (relocation <= 20) return 5
    if (relocation <= 25) return 4
    if (relocation <= 30) return 3
    if (relocation <= 35) return 2
    return 1
  }

  const calculateF9AvailabilityScore = (f9Percent) => {
    const f9 = parseFloat(f9Percent)
    if (f9 > 66) return 5
    if (f9 === 65) return 4
    if (f9 >= 55) return 3
    if (f9 >= 50.01) return 2
    return 1
  }

  const calculateAgedCasesScore = (agedPercent) => {
    const aged = parseFloat(agedPercent)
    if (aged < 10) return 5
    if (aged === 10) return 4
    if (aged <= 15) return 3
    if (aged <= 20) return 2
    return 1
  }

  const calculateResolutionTimeScore = (avgDays, isUrgent = false) => {
    const days = parseFloat(avgDays)
    if (isUrgent) {
      // URGENT group scoring
      if (days < 4) return 5
      if (days === 4) return 4
      if (days <= 6) return 3
      if (days <= 9) return 2
      return 1
    } else {
      // MEDIUM group scoring
      if (days < 9) return 5
      if (days === 10) return 4
      if (days <= 15) return 3
      if (days <= 20) return 2
      return 1
    }
  }

  // New function for URGENT group - % resolved before check-in
  const calculateBeforeCheckinScore = (beforeCheckinPercent) => {
    const percentage = parseFloat(beforeCheckinPercent)
    if (percentage > 90) return 5
    if (percentage === 90) return 4
    if (percentage >= 80) return 3
    if (percentage >= 70) return 2
    return 1
  }

  const calculateDetailedKPIs = () => {
    console.log('Calculating KPIs...') // Debug log
    console.log('Selected Agent:', selectedAgent)
    console.log('Selected Month:', selectedMonth)
    console.log('Total Data Length:', data.length)
    
    const filteredData = filterDataByMonthAndAgent()
    console.log('Filtered Data Length:', filteredData.length)
    
    // Debug: Show some sample dates from the data
    const sampleDates = data.slice(0, 5).map(row => ({
      agent: row.Agent,
      resolutionDate: row['Resolution Date'],
      parsed: parseExcelDate(row['Resolution Date'])
    }));
    console.log('Sample dates:', sampleDates);
    
    if (filteredData.length === 0) {
      alert(`No data found for ${selectedAgent} in ${selectedMonth}. Please check if the agent has cases in the selected month.`)
      setKpiResults(null)
      return
    }

    const agentGroup = getAgentGroup(selectedAgent)
    const isUrgent = agentGroup === 'URGENT'

    // Filter only cases where the agent is the PRIMARY agent (Agent column, not Assigned To)
    const primaryAgentCases = filteredData.filter(row => row.Agent === selectedAgent)
    
    // Basic metrics - use primary agent cases only
    const totalCases = primaryAgentCases.length
    const completedCases = primaryAgentCases.filter(row => row.Status === 'Completed').length
    const completionRate = ((completedCases / totalCases) * 100).toFixed(2)

    // Relocation calculation - Primary END TO END Agent Only (NO ASSIGNED TO in CASE)
    // Look for specific statuses: Cancelled Agent AWARE, Bookout Confirmed - Internal/External
    const relocationCases = primaryAgentCases.filter(row => {
      const status = row.Status || ''
      return status === 'Cancelled Agent AWARE' || 
             status === 'Bookout Confirmed - Internal' || 
             status === 'Bookout Confirmed - External' ||
             status === 'Cancelled Agent Aware' || // Alternative spelling
             status === 'Bookout Internal' ||
             status === 'Bookout External' ||
             status.toLowerCase().includes('cancelled agent aware') ||
             status.toLowerCase().includes('bookout confirmed')
    })
    
    const relocationCount = relocationCases.length
    const relocationPercent = totalCases > 0 ? ((relocationCount / totalCases) * 100).toFixed(2) : 0

    console.log('Primary Agent Cases:', totalCases)
    console.log('Relocation Cases Found:', relocationCount)
    console.log('Relocation Statuses:', relocationCases.map(row => row.Status))

    // For URGENT: % resolved before check-in date - use primary agent cases
    let beforeCheckinPercent = 0
    let beforeCheckinCases = 0
    if (isUrgent) {
      const casesWithTravelDate = primaryAgentCases.filter(row => row['Travel Date'] && row['Resolution Date'])
      beforeCheckinCases = casesWithTravelDate.filter(row => {
        const travelDate = parseExcelDate(row['Travel Date']);
        const resolutionDate = parseExcelDate(row['Resolution Date']);
        return travelDate && resolutionDate && !isNaN(travelDate.getTime()) && !isNaN(resolutionDate.getTime()) && resolutionDate < travelDate;
      }).length
      beforeCheckinPercent = casesWithTravelDate.length > 0 ? 
        ((beforeCheckinCases / casesWithTravelDate.length) * 100).toFixed(2) : 0
    }

    // For MEDIUM: Aged cases calculation (pending > 30 days) - use primary agent cases
    let agedCasesPercent = 0
    let agedCases = 0
    let pendingCasesCount = 0
    if (!isUrgent) {
      const currentDate = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(currentDate.getDate() - 30)
      
      const pendingCases = primaryAgentCases.filter(row => 
        row.Status !== 'Completed' && row.Status !== 'Closed'
      )
      pendingCasesCount = pendingCases.length
      
      agedCases = pendingCases.filter(row => {
        const allocatedField = row['Allocated'] || row['Assigned Date'] || row['Query Date']
        if (!allocatedField) return false
        
        const allocatedDate = parseExcelDate(allocatedField);
        return allocatedDate && !isNaN(allocatedDate.getTime()) && allocatedDate < thirtyDaysAgo;
      }).length
      
      agedCasesPercent = pendingCases.length > 0 ? 
        ((agedCases / pendingCases.length) * 100).toFixed(2) : 0
    }

    // Average resolution time - use primary agent cases
    const resolvedCases = primaryAgentCases.filter(row => {
      const hasResolutionDate = row['Resolution Date']
      const hasStartDate = row['Allocated'] || row['Assigned Date'] || row['Query Date']
      return hasResolutionDate && hasStartDate
    })
    
    const resolutionTimes = resolvedCases.map(row => {
      const startDate = parseExcelDate(row['Allocated'] || row['Assigned Date'] || row['Query Date']);
      const resolvedDate = parseExcelDate(row['Resolution Date']);
      
      if (!startDate || !resolvedDate || isNaN(startDate.getTime()) || isNaN(resolvedDate.getTime())) {
        return null;
      }
      
      return (resolvedDate - startDate) / (1000 * 60 * 60 * 24); // days
    }).filter(time => time !== null && time >= 0)
    
    const avgResolutionTime = resolutionTimes.length > 0 ? 
      (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1) : 0

    // Calculate scores - handle empty manual inputs
    const agentErrorScore = manualInputs.agentError !== '' ? calculateAgentErrorScore(manualInputs.agentError) : 0
    const qualityScore = manualInputs.quality !== '' ? calculateQualityScore(manualInputs.quality) : 0
    const relocationScore = calculateRelocationScore(relocationPercent)
    const f9Score = manualInputs.f9Availability !== '' ? calculateF9AvailabilityScore(manualInputs.f9Availability) : 0
    const resolutionTimeScore = avgResolutionTime > 0 ? calculateResolutionTimeScore(avgResolutionTime, isUrgent) : 0
    
    // Group-specific calculations
    let groupSpecificScore = 0
    let groupSpecificPercent = 0
    let groupSpecificLabel = ''
    let groupSpecificCases = 0
    
    if (isUrgent) {
      groupSpecificScore = calculateBeforeCheckinScore(beforeCheckinPercent)
      groupSpecificPercent = beforeCheckinPercent
      groupSpecificLabel = 'Before Check-in'
      groupSpecificCases = beforeCheckinCases
    } else {
      groupSpecificScore = calculateAgedCasesScore(agedCasesPercent)
      groupSpecificPercent = agedCasesPercent
      groupSpecificLabel = 'Aged Cases'
      groupSpecificCases = agedCases
    }

    // Weighted final score (both groups use same weights)
    const finalScore = (
      (agentErrorScore * 0.10) +
      (qualityScore * 0.40) +
      (relocationScore * 0.15) +
      (f9Score * 0.10) +
      (groupSpecificScore * 0.15) +
      (resolutionTimeScore * 0.10)
    ).toFixed(2)

    // Status breakdown - use all filtered data for display
    const statusBreakdown = filteredData.reduce((acc, row) => {
      const status = row.Status || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    const issueTypeBreakdown = filteredData.reduce((acc, row) => {
      const issueType = row['Issue Type'] || 'Unknown'
      acc[issueType] = (acc[issueType] || 0) + 1
      return acc
    }, {})

    console.log('KPI Results calculated successfully') // Debug log

    setKpiResults({
      totalCases,
      completedCases,
      completionRate,
      statusBreakdown,
      issueTypeBreakdown,
      filteredData, // Keep all filtered data for table display
      agentGroup,
      isUrgent,
      // Detailed KPIs
      relocationPercent,
      avgResolutionTime,
      // Group-specific metrics
      groupSpecificPercent,
      groupSpecificLabel,
      groupSpecificCases,
      // URGENT specific
      beforeCheckinPercent: isUrgent ? beforeCheckinPercent : null,
      beforeCheckinCases: isUrgent ? beforeCheckinCases : null,
      // MEDIUM specific  
      agedCasesPercent: !isUrgent ? agedCasesPercent : null,
      agedCases: !isUrgent ? agedCases : null,
      pendingCases: !isUrgent ? pendingCasesCount : null,
      // Scores
      agentErrorScore,
      qualityScore,
      relocationScore,
      f9Score,
      groupSpecificScore,
      resolutionTimeScore,
      finalScore,
      // Raw values for display
      bookoutCases: relocationCount, // Updated to use relocation count
      resolvedCases: resolvedCases.length
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Webbeds KPI Dashboard</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Excel File</h2>
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {data.length > 0 && (
            <p className="mt-3 text-sm text-green-600">Loaded {data.length} records</p>
          )}
        </div>

        {/* Manual Inputs Section */}
        {data.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Manual KPI Inputs</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Error (1=Yes, 0=No)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  value={manualInputs.agentError}
                  onChange={(e) => setManualInputs(prev => ({...prev, agentError: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0 or 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quality Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualInputs.quality}
                  onChange={(e) => setManualInputs(prev => ({...prev, quality: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter percentage"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">F9 Availability (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualInputs.f9Availability}
                  onChange={(e) => setManualInputs(prev => ({...prev, f9Availability: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter percentage"
                />
              </div>
            </div>
          </div>
        )}

        {data.length > 0 && selectedAgent && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              KRA/KPI Overview for {selectedAgent} ({getAgentGroup(selectedAgent)} Group)
            </h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-red-500 text-white">
                    <th className="border border-gray-300 px-4 py-3 text-left font-medium">
                      Key Result Areas<br/>(KRAs)
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-medium">
                      Key Performance Indicators<br/>(KPIs)
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-medium">Target</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-medium">Weight</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-medium">
                      Actual<br/>Agent KPI
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-medium">
                      Actual<br/>Score
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-medium">
                      Weighted<br/>Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-red-100">
                    <td className="border border-gray-300 px-4 py-3 font-medium" rowSpan="4">
                      CUSTOMER SERVICE MISSION - EFFICIENCY<br/>
                      <span className="text-sm font-normal">Deliver exceptional operational efficiency</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">% of Relocations</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">25%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">15.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {kpiResults ? `${kpiResults.relocationPercent}%` : '0.00%'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.relocationScore : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.relocationScore * 0.15).toFixed(2) : '0.75'}
                    </td>
                  </tr>
                  <tr className="bg-red-100">
                    <td className="border border-gray-300 px-4 py-3">AVG Resolution Time</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {getAgentGroup(selectedAgent) === 'URGENT' ? '4 days' : '10 days'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">10.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {kpiResults ? `${kpiResults.avgResolutionTime} days` : '0.00 days'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.resolutionTimeScore : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.resolutionTimeScore * 0.10).toFixed(2) : '0.50'}
                    </td>
                  </tr>
                  <tr className="bg-red-100">
                    <td className="border border-gray-300 px-4 py-3">F9 Availability</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">65%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">10.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {manualInputs.f9Availability ? `${manualInputs.f9Availability}%` : '0.00%'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.f9Score : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.f9Score * 0.10).toFixed(2) : '0.50'}
                    </td>
                  </tr>
                  <tr className="bg-red-100">
                    <td className="border border-gray-300 px-4 py-3">
                      {getAgentGroup(selectedAgent) === 'URGENT' ? '% resolved before check-in date' : 'Aged Cases'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {getAgentGroup(selectedAgent) === 'URGENT' ? '90%' : '10%'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">15.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {kpiResults ? `${kpiResults.groupSpecificPercent}%` : '0.00%'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.groupSpecificScore : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.groupSpecificScore * 0.15).toFixed(2) : '0.75'}
                    </td>
                  </tr>
                  <tr className="bg-blue-100">
                    <td className="border border-gray-300 px-4 py-3 font-medium">
                      CUSTOMER SERVICE MISSION - QUALITY<br/>
                      <span className="text-sm font-normal">Deliver best-in-class customer service</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">Quality monitoring</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">90%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">40.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {manualInputs.quality ? `${manualInputs.quality}%` : '0.00%'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.qualityScore : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.qualityScore * 0.40).toFixed(2) : '2.00'}
                    </td>
                  </tr>
                  <tr className="bg-yellow-100">
                    <td className="border border-gray-300 px-4 py-3 font-medium">
                      CUSTOMER SERVICE MISSION - RESPONSIBILITY<br/>
                      <span className="text-sm font-normal">Foster culture of Responsibility and Value creation</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">Agent Losses</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">0%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">10.00%</td>
                    <td className="border border-gray-300 px-4 py-3 text-center bg-green-100">
                      {manualInputs.agentError === '1' ? 'Yes' : manualInputs.agentError === '0' ? 'No' : 'Not Set'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? kpiResults.agentErrorScore : '5.0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {kpiResults ? (kpiResults.agentErrorScore * 0.10).toFixed(2) : '0.50'}
                    </td>
                  </tr>
                  <tr className="bg-yellow-300 font-bold">
                    <td className="border border-gray-300 px-4 py-3" colSpan="5">Overall Score</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-xl">
                      {kpiResults ? kpiResults.finalScore : '5.00'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Group</label>
                <select 
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value)
                    setSelectedAgent('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Groups</option>
                  <option value="URGENT">URGENT</option>
                  <option value="MEDIUM">MEDIUM</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Agent</label>
                <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose Agent</option>
                  {getUniqueAgents().map(agent => {
                    const group = getAgentGroup(agent)
                    return (
                      <option key={agent} value={agent}>
                        {agent} {group !== 'OTHER' && `(${group})`}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <button 
                  onClick={calculateDetailedKPIs} 
                  disabled={!selectedMonth || !selectedAgent}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Calculate KPIs
                </button>
              </div>
            </div>
          </div>
        )}

        {kpiResults && (
          <div className="space-y-6">
            {/* Final Score Card */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Final KPI Score</h2>
                <p className="text-5xl font-bold mb-2">{kpiResults.finalScore}/5.0</p>
                <p className="text-lg">{selectedAgent} - {selectedMonth}</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                  kpiResults.agentGroup === 'URGENT' ? 'bg-red-200 text-red-800' :
                  kpiResults.agentGroup === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {kpiResults.agentGroup} Priority
                </span>
              </div>
            </div>

            {/* Detailed KPI Breakdown */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">
                KPI Breakdown ({kpiResults.agentGroup} Group Criteria)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">Agent Error (10%)</h4>
                  <p className="text-2xl font-bold text-blue-600">{kpiResults.agentErrorScore}/5</p>
                  <p className="text-sm text-gray-600">
                    Value: {manualInputs.agentError === '1' ? 'Yes' : manualInputs.agentError === '0' ? 'No' : 'Not Set'}
                  </p>
                  <p className="text-xs text-gray-500">Target: 0.00 (No errors)</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">Quality (40%)</h4>
                  <p className="text-2xl font-bold text-green-600">{kpiResults.qualityScore}/5</p>
                  <p className="text-sm text-gray-600">Value: {manualInputs.quality}%</p>
                  <p className="text-xs text-gray-500">Target: 90%</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">Relocations (15%)</h4>
                  <p className="text-2xl font-bold text-purple-600">{kpiResults.relocationScore}/5</p>
                  <p className="text-sm text-gray-600">Value: {kpiResults.relocationPercent}% ({kpiResults.bookoutCases} cases)</p>
                  <p className="text-xs text-gray-500">Target: 25%</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">F9 Availability (10%)</h4>
                  <p className="text-2xl font-bold text-yellow-600">{kpiResults.f9Score}/5</p>
                  <p className="text-sm text-gray-600">Value: {manualInputs.f9Availability}%</p>
                  <p className="text-xs text-gray-500">Target: 65%</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">{kpiResults.groupSpecificLabel} (15%)</h4>
                  <p className="text-2xl font-bold text-red-600">{kpiResults.groupSpecificScore}/5</p>
                  <p className="text-sm text-gray-600">
                    Value: {kpiResults.groupSpecificPercent}% 
                    {kpiResults.isUrgent ? 
                      ` (${kpiResults.beforeCheckinCases} before check-in)` : 
                      ` (${kpiResults.agedCases}/${kpiResults.pendingCases})`
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    Target: {kpiResults.isUrgent ? '90%' : '10%'}
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">Avg Resolution Time (10%)</h4>
                  <p className="text-2xl font-bold text-indigo-600">{kpiResults.resolutionTimeScore}/5</p>
                  <p className="text-sm text-gray-600">Value: {kpiResults.avgResolutionTime} days</p>
                  <p className="text-xs text-gray-500">
                    Target: {kpiResults.isUrgent ? '4 days' : '10 days'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Basic Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <h4 className="text-lg font-medium text-blue-900 mb-2">Total Cases</h4>
                  <p className="text-3xl font-bold text-blue-600">{kpiResults.totalCases}</p>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-medium text-green-900 mb-2">Completed Cases</h4>
                  <p className="text-3xl font-bold text-green-600">{kpiResults.completedCases}</p>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-medium text-purple-900 mb-2">Completion Rate</h4>
                  <p className="text-3xl font-bold text-purple-600">{kpiResults.completionRate}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Filtered Data ({kpiResults.filteredData.length} records)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bk. Ref.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hotel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {kpiResults.filteredData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row['Ticket ID']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row['Bk. Ref.']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.Platform}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{row.Hotel}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            row.Status === 'Completed' ? 'bg-green-100 text-green-800' : 
                            row.Status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.Status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row['Issue Type']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row['Resolution Date']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
