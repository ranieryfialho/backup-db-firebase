import { useState } from 'react';
import { useSnackbar } from 'notistack';

import {
  Button, Checkbox, FormGroup, FormControlLabel, Paper,
  createTheme, ThemeProvider, CssBaseline, CircularProgress,
  Typography, Container, Box, Accordion, AccordionSummary, AccordionDetails, Link, IconButton
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import CodeIcon from '@mui/icons-material/Code';
import ClearIcon from '@mui/icons-material/Clear';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const { enqueueSnackbar } = useSnackbar();

  const [serviceAccountKey, setServiceAccountKey] = useState(null);
  const [fileName, setFileName] = useState('');
  const [availableCollections, setAvailableCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState({});
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [error, setError] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setServiceAccountKey(file);
    setFileName(file.name);
    setAvailableCollections([]);
    setSelectedCollections({});
    setError('');
    setIsLoadingCollections(true);

    const formData = new FormData();
    formData.append('serviceAccountKey', file);

    try {
      const response = await fetch('http://127.0.0.1:5000/api/list-collections', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido.');
      setAvailableCollections(data.collections);
      enqueueSnackbar('Coleções carregadas com sucesso!', { variant: 'success' });
    } catch (err) {
      setError(err.message);
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleCheckboxChange = (event) => {
    setSelectedCollections({
      ...selectedCollections,
      [event.target.name]: event.target.checked,
    });
  };

  const handleBackupClick = async () => {
    const collectionsToBackup = Object.keys(selectedCollections).filter(key => selectedCollections[key]);
    if (collectionsToBackup.length === 0) {
      enqueueSnackbar('Por favor, selecione pelo menos uma coleção.', { variant: 'warning' });
      return;
    }
    
    setIsBackingUp(true);
    setError('');

    const formData = new FormData();
    formData.append('serviceAccountKey', serviceAccountKey);
    formData.append('collections', collectionsToBackup.join(','));

    try {
      const response = await fetch('http://127.0.0.1:5000/api/generate-backup', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar o backup.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const disposition = response.headers.get('content-disposition');
      let filename = `firestore_backup_${new Date().toISOString()}.json`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      enqueueSnackbar('Backup gerado e download iniciado!', { variant: 'success' });
    } catch (err) {
      setError(err.message);
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSelectAllChange = (event) => {
    const newSelectedCollections = {};
    if (event.target.checked) {
      availableCollections.forEach(collectionName => {
        newSelectedCollections[collectionName] = true;
      });
    }
    setSelectedCollections(newSelectedCollections);
  };
  
  const handleRemoveFile = () => {
    setServiceAccountKey(null);
    setFileName('');
    setAvailableCollections([]);
    setSelectedCollections({});
    setError('');
    document.querySelector('input[type="file"]').value = '';
  };

  const numSelected = Object.values(selectedCollections).filter(Boolean).length;
  const allSelected = availableCollections.length > 0 && numSelected === availableCollections.length;
  const someSelected = numSelected > 0 && numSelected < availableCollections.length;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ my: 4, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              
              <Typography variant="h4" component="h1">Firebase Backup Service</Typography>
              
              {!fileName ? (
                <Button component="label" variant="outlined" startIcon={<FileUploadIcon />}>
                  Selecionar Chave de Serviço (.json)
                  <input type="file" hidden accept=".json" onChange={handleFileChange} />
                </Button>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px dashed grey', p: 1, borderRadius: 1 }}>
                  <Typography variant="body2">{fileName}</Typography>
                  <IconButton size="small" onClick={handleRemoveFile} title="Remover arquivo">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}

              {isLoadingCollections && <CircularProgress sx={{ my: 2 }} />}
              {error && <Typography color="error" sx={{ my: 2, display: 'none' }}>Erro: {error}</Typography>}

              {availableCollections.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>Selecione as Coleções</Typography>
                  <FormGroup>
                    <FormControlLabel
                      label="Selecionar Todas"
                      control={
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onChange={handleSelectAllChange}
                        />
                      }
                    />
                    {availableCollections.map(collectionName => (
                      <FormControlLabel
                        key={collectionName}
                        control={<Checkbox checked={!!selectedCollections[collectionName]} onChange={handleCheckboxChange} name={collectionName} />}
                        label={collectionName}
                      />
                    ))}
                  </FormGroup>
                </Box>
              )}
              <Button
                variant="contained"
                size="large"
                onClick={handleBackupClick}
                disabled={isBackingUp || availableCollections.length === 0}
                sx={{ mt: 2 }}
              >
                {isBackingUp ? <CircularProgress size={24} color="inherit" /> : 'Gerar Backup'}
              </Button>
            </Box>
          </Paper>

          <Box sx={{ mt: 4 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Como obter sua Chave de Serviço (.json)?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography component="div" align="left">
                  <ol>
                    <li>Acesse o <strong>Console do Firebase</strong> do seu projeto.</li>
                    <li>Clique no ícone de engrenagem (Configurações) e vá para <strong>"Configurações do projeto"</strong>.</li>
                    <li>Selecione a aba <strong>"Contas de serviço"</strong>.</li>
                    <li>Clique no botão <strong>"Gerar nova chave privada"</strong> para baixar o arquivo .json.</li>
                  </ol>
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <SecurityIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography><strong>Sua Segurança é Nossa Prioridade</strong></Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>
                  Esta aplicação foi construída com total respeito à sua privacidade e segurança.
                  É fundamental que você saiba:
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Nenhum dado é capturado ou armazenado.</strong> Sua chave de serviço é utilizada <strong>exclusivamente em memória</strong> durante a requisição para se conectar ao Firebase e listar suas coleções. Ela nunca é salva em nosso servidor. O único propósito desta ferramenta é gerar um arquivo de backup que é baixado <strong>diretamente para o seu computador local</strong>.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>
        
        <Box component="footer" sx={{ py: 3, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
            <CodeIcon fontSize="small" />
            <Typography variant="body2">
              Desenvolvido por
            </Typography>
            <Link href="https://github.com/ranieryfialho" target="_blank" rel="noopener noreferrer" color="inherit" underline="hover">
              Raniery Fialho
            </Link>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;