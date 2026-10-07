module.exports={
 projects:[
  {displayName:'unit',testMatch:['<rootDir>/test-dist/test/**/*.unit.spec.js'],transform:{},testEnvironment:'node'},
  {displayName:'e2e',testMatch:['<rootDir>/test-dist/test/**/*.e2e.spec.js'],transform:{},testEnvironment:'node',testTimeout:60000}
 ]
};
