<template>
  <div class="main-container">
    <div v-if="!project">
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh;">
      <img src="../assets/dumpdifflogo.png" alt="Centered Image" style="max-width: 100%; max-height: 80%; object-fit: contain; margin-bottom: 20px; margin-top: -100px;">
      <select v-model="selectedProject" @change="handleProjectSelection()" style="width: 200px; padding: 5px;">
        <option v-for="p in projects" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>
  </div>
    <div v-if="project" class="jar-selectors">
      <select v-model="selectedJar1" @change="handleJarSelection('pane1')">
        <option value="">Select JAR for left pane</option>
        <option v-for="jar in jarFiles" :key="jar" :value="jar">{{ jar }}</option>
      </select>
      <select v-model="selectedJar2" @change="handleJarSelection('pane2')">
        <option value="">Select JAR for right pane</option>
        <option v-for="jar in jarFiles" :key="jar" :value="jar">{{ jar }}</option>
      </select>
    </div>
    <div class="content-container" v-if="project">
      <div class="row">
        <div class="pane">
          <div class="scrollable">
            <FolderTree @fileSelected="handleFileSelected" pane="pane1" ref="pane1Tree" />
          </div>
        </div>
        <div class="pane">
          <div class="scrollable">
            <FolderTree @fileSelected="handleFileSelected" pane="pane2" ref="pane2Tree"/>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="pane">
          <div class="scrollable">
            <div class="file-info">
              <span>{{ selectedFile1 }}</span>
              <button @click="decompile('pane1')" :disabled="!selectedFile1 || !selectedFile1.endsWith('.class')">Decompile</button>
            </div>
            <pre v-html="assemblyCode1"></pre>
          </div>
        </div>
        <div class="pane">
          <div class="scrollable">
            <div class="file-info">
              <span>{{ selectedFile2 }}</span>
              <button @click="decompile('pane2')" :disabled="!selectedFile2 || !selectedFile2.endsWith('.class')">Decompile</button>
            </div>
            <pre v-html="assemblyCode2"></pre>
          </div>
        </div>
      </div>
    </div>
    <div class="compare-section" v-if="project">
      <button @click="compareClicked">
        {{ showDiff ? 'Hide Diff' : 'Show Diff' }}
      </button> 
      <button @click="toggleSyncScroll" v-if="showDiff">
        {{ syncScrollEnabled ? 'Disable Sync Scroll' : 'Enable Sync Scroll' }}
      </button>
    </div>
    <CodeDiffTool v-if="showDiff" :code1="assemblyCode1" :code2="assemblyCode2" ref="codeDiffTool"/>
  </div>
</template>

<script>
import axios from 'axios';
import FolderTree from './FolderTree.vue';
import CodeDiffTool from './CodeDiffTool.vue';
import {v4 as uuidv4} from 'uuid';

export default {
  name: 'JavaDecompiler',
  components: {
    FolderTree,
    CodeDiffTool,
  },
  data() {
    return {
      project: null,
      jarFiles: [],
      projects: [],
      selectedJar1: '',
      selectedJar2: '',
      selectedFile1: null,
      assemblyCode1: '',
      selectedFile2: null,
      assemblyCode2: '',
      showDiff: false,
      eventSrc: null,
      uuid: uuidv4(),
      syncScrollEnabled: false,
    };
  },
  methods: {
          async handleProjectSelection() {
                  this.project =  this.selectedProject;
                  console.log("project",this.project);
      await this.fetchJarFiles();
          },
    async fetchProjects() {
      try {
        const response = await axios.get('http://localhost:3000/getProjects');
        this.projects = response.data.projectDirs;
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
     },
    async fetchJarFiles() {
      const project = this.project;
      try {
              const response = await axios.post('http://localhost:3000/getJarFiles', {project});
        this.jarFiles = response.data.jarFiles;
      } catch (error) {
        console.error('Error fetching JAR files:', error);
      }
    },
    async handleJarSelection(pane) {
      const selectedJar = pane === 'pane1' ? this.selectedJar1 : this.selectedJar2;
      if (selectedJar) {
        await this.unzipJar(selectedJar, pane);
      }
    },
    async unzipJar(jarFileName, pane) {
      try {
        const response = await axios.post('http://localhost:3000/unzip', { "jarFile": jarFileName , "project": this.project});
        if (pane === 'pane1') {
          this.$refs.pane1Tree.refreshTree(response.data.structure);
        } else if (pane === 'pane2') {
          this.$refs.pane2Tree.refreshTree(response.data.structure);
        }

              if (this.selectedJar1 && this.selectedJar2) { 
                      await axios.post('http://localhost:3000/checkSums?id='+this.uuid, {"project": this.project, "file1": this.selectedJar1, "file2": this.selectedJar2});
                      console.log("creating event listener");
                      let eventSrc = new EventSource("http://localhost:3000/poll?id="+this.uuid);
        eventSrc.onmessage = (event) => {
                var data = JSON.parse(event.data);
                if (data[1] == 'diff') {
                        this.$refs.pane1Tree.updateDiff(data[0]);
                        this.$refs.pane2Tree.updateDiff(data[0]);
                }
        };

              }
              } catch (error) {
        console.error('Error unzipping jar file:', error);
      }
    },
    async handleFileSelected(file, pane) {
      const filePath = typeof file === 'object' && file.path ? file.path : file;

      if (pane === 'pane1') {
        this.selectedFile1 = filePath;
      } else if (pane === 'pane2') {
        this.selectedFile2 = filePath;
      }

      if (filePath.endsWith('.java')) {
        try {
          const response = await axios.get('http://localhost:3000/readJavaFile', {
            params: { filePath }
          });
          const escapedCode = this.escapeHtml(response.data.content);
          if (pane === 'pane1') {
            this.assemblyCode1 = escapedCode;
          } else if (pane === 'pane2') {
            this.assemblyCode2 = escapedCode;
          }
        } catch (error) {
          console.error('Error reading Java file:', error);
        }
      }
    },
    async decompile(pane) {
      let selectedFile = null;
      let selectedJarFile = null;
      if (pane === 'pane1') {
        selectedFile = this.selectedFile1;
        selectedJarFile = this.selectedJar1;
      } else if (pane === 'pane2') {
        selectedFile = this.selectedFile2;
        selectedJarFile = this.selectedJar2;
      }

      if (!selectedFile) return;

      try {
        const fileName = this.getFileName(selectedFile);
        console.log('Sending decompile request for file:', selectedFile);
        const response = await axios.post('http://localhost:3000/decompile', { "jar": selectedJarFile, "file":selectedFile, "project":this.project});
        console.log('Decompile response received:', response.data);
        const escapedCode = this.escapeHtml(response.data.assemblyCode);
        if (pane === 'pane1') {
          this.assemblyCode1 = escapedCode;
          this.selectedFile1 = `${fileName.replace('.class', '.java')} (Decompiled)`;
          console.log('Decompiled code set for pane1');
        } else if (pane === 'pane2') {
          this.assemblyCode2 = escapedCode;
          this.selectedFile2 = `${fileName.replace('.class', '.java')} (Decompiled)`;
          console.log('Decompiled code set for pane2');
        }
      } catch (error) {
        console.error('Error decompiling file:', error);
        const errorMessage = error.response?.data?.error || error.message;
        const errorDetails = error.response?.data?.details || 'No additional details';
        console.error('Error message:', errorMessage);
        console.error('Error details:', errorDetails);
        const errorOutput = this.escapeHtml(`Error decompiling file: ${errorMessage}\nDetails: ${errorDetails}\nPlease check the server logs and try again.`);
        if (pane === 'pane1') {
          this.assemblyCode1 = errorOutput;
          console.log('Error message set for pane1');
        } else if (pane === 'pane2') {
          this.assemblyCode2 = errorOutput;
          console.log('Error message set for pane2');
        }
      }
    },
    compareClicked() {
      this.showDiff = !this.showDiff;
      if (!this.showDiff) {
        this.syncScrollEnabled = false;
      }
    },
    toggleSyncScroll() {
      if (this.$refs.codeDiffTool) {
        this.$refs.codeDiffTool.toggleSyncScroll();
        this.syncScrollEnabled = !this.syncScrollEnabled;
      }
    },
    escapeHtml(unsafe) {
      return unsafe
        
    },
    getFileName(filePath) {
            console.log("Filepath is: "+filePath);
      return filePath.split('/').pop();
    },
  },
  mounted() {
    this.fetchProjects();
  },
};
</script>

<style scoped>
@import '../assets/styles.css';

.jar-selectors {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
  margin-top: 20px;
}

.jar-selectors select {
  width: 45%;
  padding: 10px;
  font-size: 16px;
}

.main-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.content-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.row {
  display: flex;
  flex: 1;
  min-height: 0;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px;
  box-sizing: border-box;
  border: solid;
  border-width: thin;
  border-color: black;
}

.scrollable {
  flex: 1;
  overflow: auto;
}

.compare-section {
  padding: 10px;
  text-align: center;
}

button {
  margin: 5px;
  padding: 5px 10px;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

h1, h2 {
  margin: 0;
  padding: 5px 0;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
</style>
