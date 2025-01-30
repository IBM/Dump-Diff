<template>
  <li class="list-group-item" 
      :class="{ 
        'highlight': isClassFile || isJarFile || isJavaFile,
        'selected': isSelected
      }" 
      @click="handleClick"
      :aria-expanded="isFolder ? String(isOpen) : undefined"
      :role="isFolder ? 'treeitem' : 'none'">
    <div class="node-content">
      <span v-if="isFolder" class="folder-icon" @click.stop="toggleFolder">
        {{ isOpen ? '▼' : '►' }}
      </span>
      <span :class="{'file-icon': !isFolder, 'folder-icon': isFolder}">
        {{ isFolder ? '📁' : '📄' }}
      </span>
      <span class="green" v-if="!isFolder && isDiff">{{ item.name }}</span>
      <span class="red" v-if="!isFolder && !isDiff">{{ item.name }}</span>
      <span  v-if="isFolder">{{ item.name }}</span>
    </div>
    <ul v-if="isFolder && isOpen" role="group">
      <TreeNode 
        v-for="child in item.children" 
        :key="child.id" 
        :item="child" 
        :diff="child.diff"
        :selectedPath="selectedPath"
        @fileSelected="handleFileSelected">
      </TreeNode>
    </ul>
  </li>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
     item: {
      type: Object,
      required: true,
    },
    diff: {
        type: Boolean,
        default: false,
    },
    selectedPath: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      isOpen: false,
    };
  },
  computed: {
    isFolder() {
      return this.item.children && this.item.children.length > 0;
    },
    isDiff() {
     return this.item.diff;
    },
    isClassFile() {
      return this.item.name.endsWith('.class');
    },
    isJarFile() {
      return this.item.name.endsWith('.jar');
    },
    isJavaFile() {
      return this.item.name.endsWith('.java');
    },
    isSelected() {
      return this.item.path === this.selectedPath;
    },
  },
  methods: {
    handleClick() {
      if (!this.isFolder) {
        this.$emit('fileSelected', this.item.path);
      }
    },
    handleFileSelected(filePath) {
      this.$emit('fileSelected', filePath);
    },
    toggleFolder() {
      if (this.isFolder) {
        this.isOpen = !this.isOpen;
      }
    },
  },
};
</script>

<style scoped>
.list-group-item {
  margin: 5px 0;
  cursor: pointer;
}
.highlight {
  border-left: 3px solid #007bff;
}
.red {
 color: red;
}
.green {
  color: green;
}
.selected {
  background-color: #e9ecef;
}
.node-content {
  display: flex;
  align-items: center;
}
.folder-icon, .file-icon {
  margin-right: 5px;
}
</style>
