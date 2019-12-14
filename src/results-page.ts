import "babel-polyfill"; // Prevent `regeneratorRuntime is not defined` error. https://github.com/babel/babel/issues/5085

import { Session } from "./results/session";
import { AttemptData, AttemptDataWithIDAndRev } from "./results/attempt";
import { Stats } from "./stats";
import { algCubingNetLink, parse, Sequence, TraversalUp, Group, BlockMove, Commutator, Conjugate, Pause, NewLine, CommentShort, CommentLong } from "alg";

// class CountMoves extends TraversalUp<number> {
//   public traverseSequence(sequence: Sequence): number {
//     let total = 0;
//     for (const part of sequence.nestedUnits) {
//       total += this.traverse(part);
//     }
//     return total;
//   }
//   public traverseGroup(group: Group): number {
//     return this.traverseSequence(group.nestedSequence);
//   }
//   public traverseBlockMove(blockMove: BlockMove): number {
//     return 1;
//   }
//   public traverseCommutator(commutator: Commutator): number {
//     return 2 * (this.traverseSequence(commutator.A) + this.traverseSequence(commutator.B));
//   }
//   public traverseConjugate(conjugate: Conjugate): number {
//     return 2 * (this.traverseSequence(conjugate.A)) + this.traverseSequence(conjugate.B);
//   }
//   public traversePause(pause: Pause): number { return 0; }
//   public traverseNewLine(newLine: NewLine): number { return 0; }
//   public traverseCommentShort(commentShort: CommentShort): number { return 0; }
//   public traverseCommentLong(commentLong: CommentLong): number { return 0; }
// }

// (window as any).CM = CountMoves

// // const countMovesInstance = new CountMoves();
// // const countMoves = countMovesInstance.traverse.bind(countMovesInstance);

const session = new Session();
let justRemoved: string;

function tdWithContent(content?: string): HTMLTableDataCellElement {
  const td = document.createElement("td");
  td.textContent = content || "";
  return td;
}

function scrambleTD(scramble: string): HTMLTableDataCellElement {
  const scrambleTD = document.createElement("td");
  const scrambleLink = document.createElement("a");
  scrambleLink.href = algCubingNetLink({
    setup: parse(scramble),
    alg: new Sequence([])
  })
  scrambleLink.textContent = scramble;
  scrambleTD.appendChild(scrambleLink);
  return scrambleTD;
}

function solutionTD(attemptData: AttemptData): HTMLTableDataCellElement {
  const solutionTD = document.createElement("td");
  try {
    let title = `${Stats.formatTime(attemptData.totalResultMs)}s`;
    if (localStorage.pouchDBUsername) {
      title += `\n${localStorage.pouchDBUsername}`;
    }
    if (attemptData.unixDate) {
      title += `\n${formatUnixDate(attemptData.unixDate)}`;
    }
    if (attemptData.solution) {
      const scrambleLink = document.createElement("a");
      scrambleLink.href = algCubingNetLink({
        setup: parse(attemptData.scramble || ""),
        alg: parse(attemptData.solution || ""),
        title
      })
      scrambleLink.textContent = "▶️";
      solutionTD.appendChild(scrambleLink);
      // const node = document.createTextNode(` (${countMoves(attemptData.solution)} ETM)`);
      // solutionTD.appendChild(node);
    }
  } catch (e) {
    console.error(e);
  }
  return solutionTD;
}

function trashTD(attempt: AttemptDataWithIDAndRev): HTMLTableDataCellElement {
  const scrambleTD = document.createElement("td");
  const trashButton = document.createElement("button");
  trashButton.textContent = "🗑";
  trashButton.addEventListener("click", () => {
    console.log("Removing", attempt);
    session.db.remove(attempt);
    trashButton.parentNode!.parentNode!.parentNode!.removeChild(trashButton.parentNode!.parentNode!);
    justRemoved = attempt._id;
  })
  scrambleTD.appendChild(trashButton);
  return scrambleTD;
}

function pad(s: number): string {
  return ("0" + s).slice(-2)
}

function formatUnixTime(unixDate: number): string {
  const date = new Date(unixDate);
  return date.getHours() + ":" + pad(date.getMinutes());
}

function formatUnixDate(unixDate: number): string {
  const date = new Date(unixDate);
  return date.getFullYear() + "-" + pad((date.getMonth() + 1)) + "-" + pad((date.getDate() + 1));
}

async function showData(): Promise<void> {
  const tableBody = document.querySelector("#results tbody") as HTMLBodyElement;
  tableBody.textContent = "";
  const attempts = (await session.mostRecentAttempts(1000)).rows.map((row) => row.doc!);
  for (const attempt of attempts) {
    if (!attempt.totalResultMs) {
      continue;
    }
    const tr = document.createElement("tr");
    tr.appendChild(tdWithContent(Stats.formatTime(attempt.totalResultMs)));
    tr.appendChild(scrambleTD(attempt.scramble || ""));
    tr.appendChild(solutionTD(attempt));
    tr.appendChild(tdWithContent(attempt.event));
    tr.appendChild(tdWithContent(formatUnixTime(attempt.unixDate) + " | " + formatUnixDate(attempt.unixDate)));
    tr.appendChild(trashTD(attempt));
    tableBody.appendChild(tr);
  }
}

function onSyncChange(change: PouchDB.Replication.SyncResult<AttemptData>): void {
  // We've only implemented full table reload (no DOM diffing). This is a hack to avoid doing that if we only removed a doc locally.
  if (!(change.change.docs.length === 1 && change.change.docs[0]._id === justRemoved)) {
    showData();
  } else {
    "known!";
  }
}

window.addEventListener("load", async () => {
  showData();
  session.startSync(onSyncChange);
})
