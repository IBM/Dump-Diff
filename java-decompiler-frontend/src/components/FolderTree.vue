<template>
  <div>
    <ul v-if="treeData.length">
      <TreeNode
        v-for="item in treeData"
        :key="item.id"
        :item="item"
        :diff="item.diff"
        :selectedPath="selectedFilePath"
        @fileSelected="handleFileSelected"
      ></TreeNode>
    </ul>
    <p v-else>No files to display. Please select a JAR file.</p>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue';

export default {
  name: 'FolderTree',
  components: {
    TreeNode,
  },
  props: {
    pane: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      treeData: [],
      diffFiles: [],
      selectedFilePath: '',
    };
  },
  methods: {
    handleFileSelected(filePath) {
      this.selectedFilePath = filePath;
      this.$emit('fileSelected', filePath, this.pane);
    },
    refreshTree(structure) {
      this.treeData = structure;
    },
    updateDiff(path){
        console.log("looking for " + path);
        function findPath(obj, match, cb) {
          if(match(obj)) {cb(obj);}
          for (let key in obj) {
            if (typeof obj[key] === 'object') {
              findPath(obj[key], match, cb);
            }
          }
        }
        const match = (obj) => obj.path === path;
        const cb = (obj) => {
                console.log("matched " + obj.path);
                obj.diff=true;
        }
        findPath(this.treeData, match, cb);
        console.log('break');
    },
  },
};
</script>
