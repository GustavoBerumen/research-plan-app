'use strict';

// RPA-138, with the core of RPA-136. One JSON document per plan, written
// whole or not at all: a write that fails leaves the document before it
// intact. The record's own version is the concurrency guard, so two people
// acting at the same moment cannot both win — the state machine refuses the
// second, and this refuses it again at the disk in case the first check was
// raced (plan-workflow.js decides; this only keeps).
//
// A local directory is the first destination, not the last: Render's disk
// forgets on redeploy, which is the same problem the feedback file has, and
// is why nothing here is enabled by default. The interface is three methods,
// so the durable store this becomes can be swapped in without the routes
// noticing.

const MAX_RECORD_BYTES = 512 * 1024;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;

function createPlanStore({ dir, fs = require('fs'), path = require('path') }) {
  if (typeof dir !== 'string' || !dir) throw new Error('A directory for plan records is required.');
  const fileFor = (id) => {
    if (!ID.test(id)) throw new Error('Invalid plan id.');
    return path.join(dir, id + '.json');
  };
  return {
    async read(id) {
      let text;
      try {
        text = await fs.promises.readFile(fileFor(id), 'utf8');
      } catch (err) {
        if (err && err.code === 'ENOENT') return null;
        throw err;
      }
      const record = JSON.parse(text);
      return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
    },
    // Written to a neighbouring name and moved into place, so a reader never
    // sees half a record and a failure never destroys the one before it.
    async write(id, record) {
      const text = JSON.stringify(record);
      if (Buffer.byteLength(text) > MAX_RECORD_BYTES) throw new Error('This plan is too large to keep.');
      const target = fileFor(id);
      const staging = target + '.' + process.pid + '.tmp';
      await fs.promises.mkdir(dir, { recursive: true });
      try {
        await fs.promises.writeFile(staging, text);
        await fs.promises.rename(staging, target);
      } catch (err) {
        try { await fs.promises.unlink(staging); } catch (ignored) { /* nothing to clean up */ }
        throw err;
      }
    },
  };
}

module.exports = { createPlanStore, MAX_RECORD_BYTES, ID };
