import gulp from 'gulp'
import babel from 'gulp-babel'
import eslint from 'gulp-eslint'
import ava from 'gulp-ava'
import del from 'del'

const paths = {
  gulpFile: 'gulpfile.babel.js',
  allSrcJs: 'src/**/*.js',
  allLibTestJs: 'lib/test/**/*.test.js',
  allLibJs: 'lib/**/*.js'
}

gulp.task('lint', () => {
  gulp.src([
    paths.allSrcJs,
    paths.gulpFile
  ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
})

gulp.task('cleanLib', ['lint'], (callback) => {
  del(['lib']).then(() => { callback() })
})

gulp.task('build', ['cleanLib'], (callback) => {
  gulp.src(paths.allSrcJs)
    .pipe(babel())
    .pipe(gulp.dest('lib'))
    .on('end', () => { callback() })
})

gulp.task('test', ['build'], () =>
  gulp.src(paths.allLibTestJs)
    .pipe(ava({nyc: true}))
)

gulp.task('cleanDist', ['test'], (callback) => {
  del(['dist']).then(() => { callback() })
})

gulp.task('dist', ['cleanDist'], () => {
  gulp.src([paths.allLibJs, `!${paths.allLibTestJs}`])
    .pipe(gulp.dest('dist'))
})

gulp.task('watch', () => {
  gulp.watch(paths.allSrcJs, ['dist'])
})

gulp.task('default', ['watch', 'dist'])
