module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      dist: {
        expand: true, cwd: 'src/', src: ['**'], dest: 'dist/'
      }
    },
    // Lint definitions
    jshint: {
      all: ["src/**.js"],
      options: {
        jshintrc: ".jshintrc"
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'dist/visualist.min.js': [ 'dist/visualist.js']
        }
      }
    },
    qunit: {
      all: ['test/**/*.html']
    },
    browserify: {
      dist: {
        options: {
          browserifyOptions: {
            standalone: '_v',
            debug: true
          }
        },
        files: {
          'dist/visualist.js': 'src/visualist.js'
        }
      }
    }
  });
  
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-qunit");
  
  grunt.loadNpmTasks("grunt-browserify");

  grunt.registerTask('build', ['browserify', 'uglify']);
  
  grunt.registerTask('test', ['jshint', 'build', 'qunit']);
  
  grunt.registerTask('default', ['build']);
};