// import { HistoryEditor } from 'slate-history';
import { Transforms, Editor } from "slate";
import { defaultOptions } from "./option";

const insertStyleId = '__slate__table__id';

// const isBlock = (block) => {
//   console.log('[selection.js]🤯[isBlock]', block);
//   return true;
// }

export function removeSelection(editor) {
  Transforms.unsetNodes(editor, 'selectionColor', {
    at: {},
    match: n => !!n.selectionColor,
  });

  // removeSelectionStyle();
  // HistoryEditor.withoutSaving(editor, () => {
  //   const editors = document.querySelectorAll('[data-slate-editor]');
  //   Array.from(editors).forEach(e => {
  //     const tables = e.querySelectorAll('table');
  //     tables.forEach(table => {
  //       const { key } = table.dataset;
  //       if (!key) return;
  //       const tableBlock = editor.value.document.getNode(key);

  //       if (!isBlock(tableBlock)) return;

  //       tableBlock.nodes.forEach(row => {
  //         if (!isBlock(row)) return;

  //         row.nodes.forEach(cell => {
  //           if (!isBlock(cell)) return;

  //           editor.setNodeByKey(cell.key, {
  //             type: cell.type,
  //             data: { ...cell.data.toObject(), selectionColor: null },
  //           });
  //         });
  //       });
  //     });
  //   });
  //   removeSelectionStyle();
  // });
}

export function removeSelectionStyle() {
  const style = document.querySelector(`style#${insertStyleId}`);
  if (style) {
    const head = document.getElementsByTagName('head');
    const first = head && head.item(0);
    first && first.removeChild(style);
  }
}

export function addSelectionStyle(editor) {
  removeSelection(editor);

  // HACK: Add ::selection style when greater than 1 cells selected.
  if (!document.querySelector(`style#${insertStyleId}`)) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = insertStyleId;
    const head = document.getElementsByTagName('head');
    const first = head && head.item(0);

    if (first) {
      first.appendChild(style);
      const stylesheet = style.sheet;

      if (stylesheet) {
        stylesheet.insertRule(`table *::selection { background: none; }`, stylesheet.cssRules.length);
      }
    }
  }

  const { selection } = editor;
  if (!selection) return;

  const [table] = [...Editor.nodes(editor, {
    match: n => n.type === defaultOptions.typeTable,
  })];

  if (!table) return;
  const tableDepth = table[1].length;

  const { cells, cellMap, cellReMap } = splitedTable(editor, table);

  let headPath = selection.anchor.path.slice(0, tableDepth + 2);
  let tailPath = selection.focus.path.slice(0, tableDepth + 2);
  
  if (cellMap[headPath.join('')]) {
    headPath = cellMap[headPath.join('')].split('')
      .map(item => parseInt(item, 10));;
  }
  
  if (cellMap[tailPath.join('')]) {
    tailPath = cellMap[tailPath.join('')].split('')
      .map(item => parseInt(item, 10));
  }
  
  headPath.forEach((item, index) => {
    headPath[index] = Math.min(item, tailPath[index]);
    tailPath[index] = Math.max(item, tailPath[index]);
  });

  const coverCellsPath = [];
  cells.forEach(([cell, path]) => {
    const isOver = path.findIndex((item, index) => {
      if (item < headPath[index] || item > tailPath[index]) {
        return true;
      }
      return false;
    });

    if (isOver < 0) {
      coverCellsPath.push([cell, path]);
    }
  })

  coverCellsPath.forEach(([, path]) => {
    let at = path;

    if (cellReMap[path.join('')]) {
      at = cellReMap[path.join('')].split('')
        .map(item => parseInt(item, 10));
    }

    Transforms.setNodes(editor, {
      selectionColor: 'rgb(185, 211, 252)',
    }, {
      at,
      match: n => n.type === defaultOptions.typeCell,
    });
  });

  return coverCellsPath;
}

export const splitedTable = (editor, table) => {
  const tableDepth = table[1].length;

  let cells = [...Editor.nodes(editor, {
    at: table[1],
    match: n => n.type === defaultOptions.typeCell,
  })];
  
  if (!cells || !cells.length) return {};

  const cellMap = {};
  const cellReMap = {};
  let cellWidth = 0;

  for (let i = 0; i < cells.length; i++) {
    const [cell, path] = cells[i];

    if (cell.data && +cell.data.colspan > 1) {
      const y = path[tableDepth];
      for (let j = i + 1; j < cells.length; j++) {
        const [, _p] = cells[j];
        if (_p[tableDepth] === y) {
          const key = cells[j][1].join('');
          cells[j][1][tableDepth + 1] += (+cell.data.colspan - 1);
          const value = cells[j][1].join('');
          cellMap[key] = value;
          cellReMap[value] = key;
        }
      }
    }

    if (cell.data && +cell.data.rowspan > 1) {
      const y = path[tableDepth];
      
      for (let j = i + 1; j < cells.length; j++) {
        const _y = cells[j][1][tableDepth];
        if (_y > y && _y < y + (+cell.data.rowspan)) {
          const key = cells[j][1].join('');
          cells[j][1][tableDepth + 1] += (+cell.data.colspan);
          const value = cells[j][1].join('');
          cellMap[key] = value;
          cellReMap[value] = key;
        }
      }
    }

    cellWidth = Math.max(
      cellWidth,
      (path[tableDepth + 1] + 1)
      + ((cell.data && cell.data.colspan) ? +cell.data.colspan : 0),
    );
  };

  

  return {
    cellWidth,
    tableDepth,
    cells,
    cellMap,
    cellReMap,
  }
}