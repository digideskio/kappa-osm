var test = require('tape')
var createDb = require('./lib/create-db')

test('delete a way (with changesets)', function (t) {
  t.plan(4)
  var batch0 = [
    {
      type: 'put',
      id: 'A',
      value: { type: 'node', lat: '64.5', lon: '-147.3', changeset: '15' }
    },
    {
      type: 'put',
      id: 'B',
      value: { type: 'node', lat: '63.9', lon: '-147.6', changeset: '15' }
    },
    {
      type: 'put',
      id: 'C',
      value: { type: 'node', lat: '64.2', lon: '-146.5', changeset: '15' }
    },
    {
      type: 'put',
      id: 'D',
      value: { type: 'way', refs: [ 'A', 'B', 'C' ], changeset: '16' }
    }
  ]
  var batch1 = [
    { type: 'del', id: 'D', value: {} }
  ]
  createDb.two(function (osm0, osm1) {
    var versions = { A: [], B: [], C: [], D: [] }
    osm0.batch(batch0, function (err, docs) {
      t.error(err)
      docs.forEach(function (doc) {
        versions[doc.id].push(doc.version)
      })
      batch1[0].links = [versions.D[0]]
      osm1.batch(batch1, function (err, docs) {
        t.error(err)
        docs.forEach(function (doc) {
          versions[doc.id].push(doc.version)
        })
        replicate(osm0, osm1, check)
      })
    })
    function check () {
      var q0 = [-148, 63, -146, 65]
      osm0.query(q0, function (err, res) {
        t.error(err)
        t.deepEqual(sortLinks(res).sort(idcmp), [
          {
            type: 'osm/element',
            id: 'A',
            element: { type: 'node', lat: '64.5', lon: '-147.3', changeset: '15' },
            links: [],
            version: versions.A[0]
          },
          {
            type: 'osm/element',
            id: 'B',
            element: { type: 'node', lat: '63.9', lon: '-147.6', changeset: '15' },
            links: [],
            version: versions.B[0]
          },
          {
            type: 'osm/element',
            id: 'C',
            element: { type: 'node', lat: '64.2', lon: '-146.5', changeset: '15' },
            links: [],
            version: versions.C[0]
          }
        ])
      })
    }
  })
})

function idcmp (a, b) {
  if (a.id === b.id) return a.version < b.version ? -1 : 1
  return a.id < b.id ? -1 : 1
}

function replicate (osm0, osm1, cb) {
  var pending = 2
  osm0.ready(onready)
  osm1.ready(onready)
  function onready () {
    if (--pending !== 0) return
    var r0 = osm0.replicate()
    var r1 = osm1.replicate()
    pending = 2
    r0.pipe(r1).pipe(r0)
    r0.once('end', onend)
    r1.once('end', onend)
  }
  function onend () {
    if (--pending !== 0) return
    var p = 2
    osm0.ready(onready)
    osm1.ready(onready)
    function onready () { if (--p === 0) cb() }
  }
}

function sortLinks (rows) {
  return rows.map(function (row) {
    var copy = Object.assign({}, row)
    copy.links = copy.links.slice().sort()
    return copy
  })
}
