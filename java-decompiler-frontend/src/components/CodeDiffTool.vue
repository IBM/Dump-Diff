<template>
  <div class="code-diff-tool">
    <div class="pane-container">
      <div class="pane">
        <div class="code-display">
          <div class="line-numbers">
            <div v-for="n in code1Lines.length" :key="n">{{ n }}</div>
          </div>
          <div class="code-content" @scroll="handleScroll($event, 0)">
            <pre><code><span v-for="(line, index) in code1Lines" :key="index" :class="{ 'highlight-red': diffLines1[index] === 'removed' }">{{ line }}</span></code></pre>
          </div>
        </div>
      </div>
      <div class="pane">
        <div class="code-display">
          <div class="line-numbers">
            <div v-for="n in code2Lines.length" :key="n">{{ n }}</div>
          </div>
          <div class="code-content" @scroll="handleScroll($event, 1)">
            <pre><code><span v-for="(line, index) in code2Lines" :key="index" :class="{ 'highlight-green': diffLines2[index] === 'added' }">{{ line }}</span></code></pre>
          </div>
        </div>
      </div>
    </div>
    <div class="controls">
      <button @click="toggleSyncScroll">{{ syncScrollEnabled ? 'Disable' : 'Enable' }} Sync Scroll</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { diffLines } from 'diff';

export default {
  name: 'CodeDiffTool',
  props: {
    code1: {
      type: String,
      default: ''
    },
    code2: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const diffLines1 = ref([]);
    const diffLines2 = ref([]);
    const syncScrollEnabled = ref(false);

    const code1Lines = computed(() => props.code1.split('\n'));
    const code2Lines = computed(() => props.code2.split('\n'));

    const diffCode = () => {
      console.log("Diffing code...");
      const diff = diffLines(props.code1, props.code2);
      diffLines1.value = new Array(code1Lines.value.length).fill(null);
      diffLines2.value = new Array(code2Lines.value.length).fill(null);

      let line1 = 0;
      let line2 = 0;

      diff.forEach((part) => {
        const lines = part.value.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();

        if (part.added) {
          lines.forEach(() => {
            diffLines2.value[line2] = 'added';
            line2++;
          });
        } else if (part.removed) {
          lines.forEach(() => {
            diffLines1.value[line1] = 'removed';
            line1++;
          });
        } else {
          lines.forEach(() => {
            line1++;
            line2++;
          });
        }
      });

      console.log("Diff complete. Highlighted lines in code1:", diffLines1.value.filter(l => l === 'removed').length);
      console.log("Diff complete. Highlighted lines in code2:", diffLines2.value.filter(l => l === 'added').length);
    };

    watch([() => props.code1, () => props.code2], () => {
      diffCode();
    }, { immediate: true });

    const handleScroll = (event, paneIndex) => {
      const lineNumbers = document.querySelectorAll('.line-numbers')[paneIndex];
      lineNumbers.scrollTop = event.target.scrollTop;

      if (syncScrollEnabled.value) {
        const otherPaneIndex = paneIndex === 0 ? 1 : 0;
        const otherPane = document.querySelectorAll('.code-content')[otherPaneIndex];
        const otherLineNumbers = document.querySelectorAll('.line-numbers')[otherPaneIndex];
        
        otherPane.scrollTop = event.target.scrollTop;
        otherLineNumbers.scrollTop = event.target.scrollTop;
      }
    };

    const toggleSyncScroll = () => {
      syncScrollEnabled.value = !syncScrollEnabled.value;
    };

    return {
      code1Lines,
      code2Lines,
      diffLines1,
      diffLines2,
      handleScroll,
      toggleSyncScroll,
      syncScrollEnabled: false,
    };
  },
};
</script>

<style scoped>
.code-diff-tool {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pane-container {
  display: flex;
  gap: 1rem;
  height: 700px;
}

.pane {
  flex: 1;
  border: 1px solid #ccc;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.code-display {
  display: flex;
  text-align: left;
  flex-grow: 1;
  overflow: hidden;
}

.line-numbers {
  padding-right: 10px;
  border-right: 1px solid #ccc;
  user-select: none;
  overflow-y: hidden;
  text-align: right;
}

.code-content {
  flex-grow: 1;
  overflow-y: auto;
  margin-left: 10px;
}

pre {
  margin: 0;
}

code {
  display: block;
  white-space: pre;
  word-wrap: normal;
}

.highlight-red {
  background-color: #d43e3e;
}

.highlight-green {
  background-color: #27b518;
}

.line-numbers > div, .code-content > pre > code > span {
  display: block;
  height: 20px;
  line-height: 20px;
}

.line-numbers > div {
  padding-right: 5px;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
