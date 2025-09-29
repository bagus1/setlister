




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts









% this causes the variables to be defined...













% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "Bluesette" }
			\fill-line {
				"Lyrics by Norman Gimbel"
				"Music by Jean 'Toots' Thielemans"
			}
			\fill-line {
				"Moderate Waltz"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	\repeat volta 2 {
		g2.*2 | fis2.:m7.5- | b:7.9- | e:m7 | a:7.9- | d:m7 | g:7 | \myEndLine
		c:maj7 | c:6 | c:m7 | f:9 | bes2.*2:maj7 | bes2.:m7 | ees:9 | \myEndLine
		aes:maj7 | aes | a:m7.5- | d:7.9- | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	}
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7 | e:m7 | a:7 | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:7 | bes:maj7 | bes:6 | bes:m7 | ees:9 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:7.9- | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7 | e:m7 | a:7 | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:7 | bes:maj7 | bes:6 | bes:7 | ees:7 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:7 | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7.9- | e:m7 | a:7.9- | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:9 | bes2.*2:maj7 | bes2.:m7 | ees:9 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:9 | b2.*2:m7 | e2.:7 | e2:7.5+ e4:7 | \myEndLine
	a2.*2:m7 | d:7 | g2. | d2:7.9+ d4:9 | b4:m7 a:m7 aes:maj7 | g2.:maj7 | \myEndLine
	\endPart

	\endSong
	\endChords
}



}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Allegro" 4 = 168
	\time 3/4
	\key g \major

	% part "A"
	\repeat volta 2 {
		d4 e fis | g a b | c2 e,4 | dis2. | b'2 d,!4 | cis2. | a'2 c,!4 | b2. |
		g'2 b,4 | c4. d8 ees f | g2 ees'4 | d2 c4 | f,2 d'4 | c2 bes4 | f2 des'4 | c2 bes4 |
		ees, f g | aes bes c | d2 c4 | b2 a4 | d,2.~ | d~ | d~ | d4 r r |
	}

	% part "A"
	g a b | d r r | c b a | g2 fis4 | e fis g | b2. | a4 g f | e2 d4 |
	g2 b,4 | c4. b8 c d | ees4. f8 g bes | a4 bes c | f,2 a,4 | bes4. c8 des ees | f2 des'4 | c2 bes4 |
	ees,8 ees f f g g | aes aes bes bes c c | d2 \tuplet 3/2 { c8 d c } | b2 a4 | d,2.~ | d~ | d | r2. |

	% part "A"
	r4 d'8 d d d | c4 b2 | r4 c8 c c c | b4 a2 | r4 b8 b b b | a4 g2 | r4 a8 a a a | g4 f2 |
	e4 f fis | g a b | c cis d | ees d c | f, g a | bes b c | cis d dis | e ees des |
	c r8 bes4. | aes4 r8 bes4 c8 | d4 r8 c4 b8 | aes4 r fis8 e | d4 d d | f d4. c8 | d2.~ | d2 r4 |

	% part "A"
	d e fis | g a b | c2 e,4 | dis2. | b'2 d,!4 | cis2. | a'2 c,!4 | b2. |
	g'2 b,4 | c4. d8 ees f! | g2 ees'4 | d2 c4 | f,!2 d'4 | c2 bes4 | f2 des'4 | c2 bes4 |
	ees, f g | aes bes c | d2 c4 | b2 a4 | e'2.~ | e~ | e2 d4 | c2 b4 |
	d2.~ | d~ | d2 c4 | b g4. e8 | g2.~ | g~ | g~ | g4 r r |
}


 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	Poor lit -- tle, sad lit -- tle blue Blues -- ette,
	don't you cry, don't you fret.
	You can bet one luck -- y day you'll wak -- en and your blues will be for -- sak -- en.
	One luck -- y day love -- ly love will come your way. __

	% part "A"
	Get set, Blues -- ette, true love is com -- ing.
	Your trou -- bled heart soon will be hum -- ming.
	\markup \italic Hum __ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
	Doo -- ya, doo -- ya, doo -- ya, doo -- ya, doo -- ya, doo -- ya,
	Doo -- oo -- _ _ oo Blues -- ette. __

	% part "A"
	Pret -- ty lit -- tle Blues -- ette must -- n't be a mourn -- er.
	Have you heard the news yet?
	Love is 'round the cor -- ner.
	Love wrapped in rain -- bows and tied with pink rib -- bon
	to make your next spring -- time your gold wed -- ding ring time.
	So, dry your eyes. Don't -- cha pout, don't -- cha fret,
	good -- y good times are com -- ing, Blues -- ette. __

	% part "A"
	Long as there's love in your heart to share, dear Blues -- ette, don't des -- pair.
	Some blue boy is long -- ing, just like you,
	to find a some -- one to be true to.
	One luck -- y day love -- ly love will come your way. __
	That mag -- ic day __
	may just be to -- day. __
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {

	% part "A"
	Long as there's love in your heart to share, dear Blues -- ette, don't des -- pair
	Some blue boy is long -- ing, just like you to find a some -- one to be true to.
	Two lov -- ing arms he can nest -- le in and stay. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	\repeat volta 2 {
		g2.*2 | fis2.:m7.5- | b:7.9- | e:m7 | a:7.9- | d:m7 | g:7 | \myEndLine
		c:maj7 | c:6 | c:m7 | f:9 | bes2.*2:maj7 | bes2.:m7 | ees:9 | \myEndLine
		aes:maj7 | aes | a:m7.5- | d:7.9- | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	}
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7 | e:m7 | a:7 | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:7 | bes:maj7 | bes:6 | bes:m7 | ees:9 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:7.9- | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7 | e:m7 | a:7 | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:7 | bes:maj7 | bes:6 | bes:7 | ees:7 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:7 | b:m7 | bes:7 | a:m7 | d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2.*2 | fis2.:m7.5- | b:7.9- | e:m7 | a:7.9- | d:m7 | g:7 | \myEndLine
	c:maj7 | c:6 | c:m7 | f:9 | bes2.*2:maj7 | bes2.:m7 | ees:9 | \myEndLine
	aes2.*2:maj7 | a2.:m7.5- | d:9 | b2.*2:m7 | e2.:7 | e2:7.5+ e4:7 | \myEndLine
	a2.*2:m7 | d:7 | g2. | d2:7.9+ d4:9 | b4:m7 a:m7 aes:maj7 | g2.:maj7 | \myEndLine
	\endPart

	\endSong
	\endChords
}




\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 168
	\time 3/4
	\key g \major

	% part "A"
	\repeat volta 2 {
		d4 e fis | g a b | c2 e,4 | dis2. | b'2 d,!4 | cis2. | a'2 c,!4 | b2. |
		g'2 b,4 | c4. d8 ees f | g2 ees'4 | d2 c4 | f,2 d'4 | c2 bes4 | f2 des'4 | c2 bes4 |
		ees, f g | aes bes c | d2 c4 | b2 a4 | d,2.~ | d~ | d~ | d4 r r |
	}

	% part "A"
	g a b | d r r | c b a | g2 fis4 | e fis g | b2. | a4 g f | e2 d4 |
	g2 b,4 | c4. b8 c d | ees4. f8 g bes | a4 bes c | f,2 a,4 | bes4. c8 des ees | f2 des'4 | c2 bes4 |
	ees,8 ees f f g g | aes aes bes bes c c | d2 \tuplet 3/2 { c8 d c } | b2 a4 | d,2.~ | d~ | d | r2. |

	% part "A"
	r4 d'8 d d d | c4 b2 | r4 c8 c c c | b4 a2 | r4 b8 b b b | a4 g2 | r4 a8 a a a | g4 f2 |
	e4 f fis | g a b | c cis d | ees d c | f, g a | bes b c | cis d dis | e ees des |
	c r8 bes4. | aes4 r8 bes4 c8 | d4 r8 c4 b8 | aes4 r fis8 e | d4 d d | f d4. c8 | d2.~ | d2 r4 |

	% part "A"
	d e fis | g a b | c2 e,4 | dis2. | b'2 d,!4 | cis2. | a'2 c,!4 | b2. |
	g'2 b,4 | c4. d8 ees f! | g2 ees'4 | d2 c4 | f,!2 d'4 | c2 bes4 | f2 des'4 | c2 bes4 |
	ees, f g | aes bes c | d2 c4 | b2 a4 | e'2.~ | e~ | e2 d4 | c2 b4 |
	d2.~ | d~ | d2 c4 | b g4. e8 | g2.~ | g~ | g~ | g4 r r |
}



}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1963, 1964 by MUSIC CORPORATION OF AMERICA, INC., New York, NY" }
	}
	\fill-line {
		\smaller \smaller { "Rights Administered by MCA MUSIC PUBLISHING, A Division of MCA Inc., New York, NY" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:25 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





