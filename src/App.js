import './App.css';

import { useState } from 'react';
import { Container, TextField, Button, Box, MenuItem } from '@mui/material';

import { ProcessTable } from './helpers/schedule_table';
import { ScheduleTable } from './helpers/schedule_table';

import {
  fcfs, nonPreEmptiveSJF, preEmptiveSJF, roundRobin,
  priorityNonPreemptive, priorityPreemptive,
  multicoreFcFs, multicoreRoundRobin, multicoreNonPreemptiveSJF,
  multicorePriority
} from './helpers/handle_values';

import { useEffect } from 'react';

import { validateScheduleResult } from './helpers/validate_results';

function App() {
  const [count, setCount] = useState('');
  const [processes, setProcesses] = useState([]);
  const [numCores, setNumCores] = useState([]);
  const [quantum, setQuantum] = useState('');
  const [selectedAlgo, setSelectedAlgo] = useState('FCFS');
  const [isDescending, setIsDescending] = useState(true);

  const [firstCome, setFirstCome] = useState([]);
  const [preEmp, setPreEmp] = useState([]);
  const [nonPreEmp, setNonPreEmp] = useState([]);
  const [robin, setRobin] = useState([]);
  const [prioNon, setPrioNon] = useState([]);
  const [prio, setPrio] = useState([]);
  const [multiFCFS, setMultiFCFS] = useState([]);
  const [multiRoundRobin, setMultiRoundRobin] = useState([]);
  const [multiNonPreemptiveSJF, setMultiNonPreemptiveSJF] = useState([]);
  const [multiPriority, setMultiPriority] = useState([]);



  const handleCountChange = (num) => {
    const value = parseInt(num.target.value, 10) || 0
    setCount(value);

    const newProcessSize = Array.from({ length: value }, (_, i) => ({
      arrivalTime: '',
      burstTime: '',
      priority: NaN,
    }));
    setProcesses(newProcessSize)
  };

  const handleProcessChange = (index, field, value) => {
    const updated = [...processes];
    updated[index][field] = value;
    setProcesses(updated);
  };

  const handleQuantumChange = (e) => {
    setQuantum(parseInt(e.target.value, 10));
  };

  const handleClear = () => {
    setCount([]);
    setQuantum([]);
    setProcesses([]);
    setNumCores([]);
    setSelectedAlgo('FCFS');
    setIsDescending(true);

    setFirstCome([]);
    setNonPreEmp([]);
    setPreEmp([]);
    setRobin([]);
    setPrioNon([]);
    setPrio([]);

    setMultiFCFS([]);
    setMultiRoundRobin([]);
    setMultiNonPreemptiveSJF([]);
    setMultiPriority([]);
  };

  const isAllPriorityNaN = (processes) => {
    return processes.every((i) => Number.isNaN(i.priority));
  };

  const submitProcess = (processes) => {
    switch (selectedAlgo) {
      case 'FCFS':
        setFirstCome(fcfs(processes));
        break;
      case 'NonPreemptiveSJF':
        setNonPreEmp(nonPreEmptiveSJF(processes));
        break;
      case 'PreemptiveSJF':
        setPreEmp(preEmptiveSJF(processes));
        break;
      case 'RoundRobin':
        setRobin(roundRobin(processes, quantum));
        break;
      case 'PriorityNonPreemptive':
        setPrioNon(priorityNonPreemptive(processes, isDescending));
        break;
      case 'PriorityPreemptive':
        setPrio(priorityPreemptive(processes, isDescending));
        break;

      case 'MulticoreFCFS':
        setMultiFCFS(multicoreFcFs(processes, numCores));
        break;
      case 'MulticoreRoundRobin':
        setMultiRoundRobin(multicoreRoundRobin(processes, quantum, numCores));
        break;
      case 'MulticoreNonPreemptiveSJF':
        setMultiNonPreemptiveSJF(multicoreNonPreemptiveSJF(processes, numCores));
        break;
      case 'MulticorePriority':
        setMultiPriority(multicorePriority(processes, numCores, isDescending));
        break;

      default:
        break;
    }
  };

  // useEffect(() => {
  //   validateScheduleResult();
  // }, []);

  return (

    <Container sx={{ p: 4 }}>
      <TextField
        label="Number of Processes?"
        type="number"
        value={count}
        onChange={handleCountChange}
        fullWidth
        sx={{ mb: 3 }}
      />

      {processes.length > 0 && (
        <ProcessTable processes={processes} onChange={handleProcessChange} />
      )}

      <TextField
        label="Number of CPUs"
        type="number"
        value={numCores}
        onChange={(e) => setNumCores(parseInt(e.target.value, 10))}
        fullWidth
        sx={{ mb: 3 }}
      />

      <TextField
        select
        label="Select Scheduling Algorithm"
        value={selectedAlgo}
        onChange={(e) => {
          const value = e.target.value;
          setSelectedAlgo(value); 
          console.log('Selected algorithm:', value);
        }}
        fullWidth
        sx={{ mb: 3 }}
      >
       {numCores === 1 && [
          <MenuItem key="FCFS" value="FCFS">FCFS</MenuItem>,
          <MenuItem key="NonPreemptiveSJF" value="NonPreemptiveSJF">Non-Preemptive SJF</MenuItem>,
          <MenuItem key="PreemptiveSJF" value="PreemptiveSJF">Preemptive SJF</MenuItem>,
          <MenuItem key="RoundRobin" value="RoundRobin">Round Robin</MenuItem>,
        ]}

        {!isAllPriorityNaN(processes) && [
          <MenuItem key="PriorityNonPreemptive" value="PriorityNonPreemptive">Priority (Non-Preemptive)</MenuItem>,
          <MenuItem key="PriorityPreemptive" value="PriorityPreemptive">Priority (Preemptive)</MenuItem>,
        ]}

        {numCores > 1 && [
          <MenuItem key="MulticoreFCFS" value="MulticoreFCFS">Multicore FCFS</MenuItem>,
          <MenuItem key="MulticoreRoundRobin" value="MulticoreRoundRobin">Multicore Round Robin</MenuItem>,
          <MenuItem key="MulticoreNonPreemptiveSJF" value="MulticoreNonPreemptiveSJF">Multicore Non-Preemptive SJF</MenuItem>,
          <MenuItem key="MulticorePriority" value="MulticorePriority">Multicore Priority</MenuItem>,
        ]}
      </TextField>

      {(selectedAlgo === "RoundRobin" || selectedAlgo === "MulticoreRoundRobin") &&
        <TextField
          label="Quantum Slices?"
          type="number"
          value={quantum}
          onChange={handleQuantumChange}
          fullWidth
          sx={{ mb: 3 }}
        />
      }

      {(selectedAlgo === "PriorityPreemptive" || selectedAlgo === "PriorityNonPreemptive") && (
        <TextField
          select
          label="Is Descending Priority?"
          value={isDescending}
          onChange={(e) => setIsDescending(e.target.value === "true" ? true : false)}
          fullWidth
          sx={{ mb: 3 }}
        >
          <MenuItem value="true">True (1 is highest)</MenuItem>
          <MenuItem value="false">False (higher number is highest)</MenuItem>
        </TextField>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
        <Button variant="contained" color="primary" onClick={() => submitProcess(processes)}>Submit</Button>
        <Button variant="contained" color="primary" onClick={handleClear}>Clear</Button>
      </Box>

      {selectedAlgo === 'FCFS' && firstCome.length > 0 && (
        <ScheduleTable schedule={firstCome} name="FCFS" />
      )}
      {selectedAlgo === 'NonPreemptiveSJF' && nonPreEmp.length > 0 && (
        <ScheduleTable schedule={nonPreEmp} name="Non-Preemptive SJF" />
      )}
      {selectedAlgo === 'PreemptiveSJF' && preEmp.length > 0 && (
        <ScheduleTable schedule={preEmp} name="Preemptive SJF" />
      )}
      {selectedAlgo === 'RoundRobin' && robin.length > 0 && (
        <ScheduleTable schedule={robin} name="Round Robin" />
      )}
      {selectedAlgo === 'PriorityNonPreemptive' && prioNon.length > 0 && (
        <ScheduleTable schedule={prioNon} name="Priority (Non-Preemptive)" />
      )}
      {selectedAlgo === 'PriorityPreemptive' && prio.length > 0 && (
        <ScheduleTable schedule={prio} name="Priority (Preemptive)" />
      )}

      {selectedAlgo === 'MulticoreFCFS' && multiFCFS.length > 0 && (
        <ScheduleTable schedule={multiFCFS} name="Multicore FCFS" />
      )}

      {selectedAlgo === 'MulticoreRoundRobin' && multiRoundRobin.length > 0 && (
        <ScheduleTable schedule={multiRoundRobin} name="Multicore Round Robin" />
      )}

      {selectedAlgo === 'MulticoreNonPreemptiveSJF' && multiNonPreemptiveSJF.length > 0 && (
        <ScheduleTable schedule={multiNonPreemptiveSJF} name="Multicore Non-Preemptive SJF" />
      )}

      {selectedAlgo === 'MulticorePriority' && multiPriority.length > 0 && (
        <ScheduleTable schedule={multiPriority} name="Multicore Priority" />
      )}

    
    </Container>
    
  );
}

export default App;
