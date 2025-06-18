import {
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, TextField, Typography,
    Box
} from '@mui/material';

export const ProcessTable = ({ processes, onChange }) => {
    return (
        <TableContainer component={Paper} sx={{ mt: 3, mb: 4 }}>
            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell>Process</TableCell>
                        <TableCell>Arrival Time</TableCell>
                        <TableCell>Burst Time</TableCell>
                        <TableCell>Priority</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {processes.map((proc, index) => (
                        <TableRow key={index}>
                            <TableCell>{`P${index + 1}`}</TableCell>
                            <TableCell>
                                <TextField
                                    type="number"
                                    value={proc.arrivalTime}
                                    onChange={(e) => onChange(index, 'arrivalTime', e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ width: '80px' }}
                                />
                            </TableCell>
                            <TableCell>
                                <TextField
                                    type="number"
                                    value={proc.burstTime}
                                    onChange={(e) => onChange(index, 'burstTime', e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ width: '80px' }}
                                />
                            </TableCell>
                            <TableCell>
                                <TextField
                                    type="number"
                                    value={proc.priority}
                                    onChange={(e) => onChange(index, 'priority', e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ width: '80px' }}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export const ScheduleTable = ({ schedule, timeline, name }) => {
  const isMulticore = Array.isArray(timeline[0]);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{name}</Typography>
      
      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Process</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Wait Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedule.map((proc, i) => (
              <TableRow key={i}>
                <TableCell>{`P${i + 1}`}</TableCell>
                <TableCell>{proc.startTime}</TableCell>
                <TableCell>{proc.endTime}</TableCell>
                <TableCell>{proc.waitTime}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Gantt Chart{isMulticore ? " (Multicore)" : ""}
      </Typography>

      {isMulticore ? (
        timeline.map((coreTimeline, coreIndex) => (
          <Box key={coreIndex} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{`Core ${coreIndex + 1}`}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
              {coreTimeline.map((block, i) => {
                const width = block.end - block.start;
                return (
                  <Box
                    key={i}
                    sx={{
                      minWidth: `${width * 20}px`,
                      height: '40px',
                      bgcolor: block.process === 'Idle' ? 'grey.500' : 'primary.main',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      border: '1px solid black',
                      mr: 1,
                    }}
                  >
                    {block.process}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
          {timeline.map((block, i) => {
            const width = block.end - block.start;
            return (
              <Box
                key={i}
                sx={{
                  minWidth: `${width * 20}px`,
                  height: '40px',
                  bgcolor: block.process === 'Idle' ? 'grey.500' : 'primary.main',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: '1px solid black',
                  mr: 1,
                }}
              >
                {block.process}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
